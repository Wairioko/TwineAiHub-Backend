import { ChatModel } from "../schema/ChatSchema.mjs";
import { connectToDatabase } from "../../utils/constants.mjs";

export const findAllModelResponsesHandler = async (event) => {
    await connectToDatabase();
    
    const { modelName, chatid } = JSON.parse(event.body);
    if (!chatid) {
        return {
            statusCode: 404,
            body: JSON.stringify({ message: "No ChatId provided" }),
        };
    }

    if (!modelName) {
        return {
            statusCode: 404,
            body: JSON.stringify({ message: "No Model Name provided" }),
        };
    }

    try {
        // Find the chat by ID
        const findChat = await ChatModel.findById(chatid);
        if (!findChat) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "Chat not found" }),
            };
        }

        // Find the specific model response within the chat
        const findModelResponse = findChat.modelResponses.find(response => response.modelName === modelName);
        if (!findModelResponse) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "No responses by this model found" }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: "Model Responses found",
                modelResponses: findModelResponse.responses
            }),
        };

    } catch (error) {
        console.error("Error finding model responses:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Server error finding model responses" })
        };
    }
};
