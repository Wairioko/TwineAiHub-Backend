import { connectToDatabase } from "../../utils/constants.mjs";
import { ChatModel } from "../schema/ChatSchema.mjs";
import {EventEmitter} from "events"

// SSE event emitter for handling model processing updates
const modelProcessingEmitter = new EventEmitter();


export const handleSSE = async (event) => {
    await connectToDatabase();

    const { chatId } = event.queryStringParameters; // Query parameter in API Gateway
    if (!chatId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "ChatId is required" }),
        };
    }

    try {
        // Set the response headers for SSE
        const headers = {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        };

        // Prepare the response stream (will use Lambda response body as stream)
        const body = [];
        const pushToStream = (data) => {
            body.push(`data: ${JSON.stringify(data)}\n\n`);
        };

        let interval;
        let isProcessingComplete = false;

        const sendUpdates = async () => {
            try {
                const chat = await ChatModel.findById(chatId)
                    .populate('modelResponses') // Populate the model responses
                    .populate('userProblemBreakdown')
                    .populate('problemStatement', 'description')
                    .populate({
                        path: 'userProblemBreakdown',
                        populate: {
                            path: 'problemStatement',
                            select: 'description',
                        },
                    });

                if (chat) {
                    pushToStream(chat);

                    isProcessingComplete =
                        chat.modelResponses.length > 0 &&
                        chat.modelResponses.every((response) => response.completed);

                    if (isProcessingComplete) {
                        clearInterval(interval);
                        pushToStream({ event: 'close', data: 'All responses completed' });
                        return {
                            statusCode: 200,
                            body: body.join(''),
                            isBase64Encoded: false,
                            headers,
                        };
                    }
                } else {
                    pushToStream({ message: 'Chat not found' });
                }
            } catch (error) {
                console.error('Error occurred while sending updates:', error);
                pushToStream({ message: 'Error occurred', error: error.message });
            }
        };

        sendUpdates();

        const onModelProcessed = () => {
            sendUpdates();
        };
        modelProcessingEmitter.on('modelProcessed', onModelProcessed);

        interval = setInterval(() => {
            if (!isProcessingComplete) {
                sendUpdates();
            }
        }, 5000);

        event.on('close', () => {
            clearInterval(interval);
            modelProcessingEmitter.off('modelProcessed', onModelProcessed);
        });

        return {
            statusCode: 200,
            body: body.join(''),
            isBase64Encoded: false,
            headers,
        };

    } catch (error) {
        console.error('Error occurred while setting up SSE:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error occurred while setting up SSE',
                error: error.message,
            }),
        };
    }
};