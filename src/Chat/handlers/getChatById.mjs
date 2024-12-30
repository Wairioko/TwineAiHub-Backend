import { connectToDatabase } from "../../utils/constants.mjs";
import { ChatModel } from "../schema/ChatSchema.mjs";

export const getChatByIdHandler = async (event) => {
    await connectToDatabase();
    
    const { chatid } = event.pathParameters || {};

    // Check if chatid is present
    if (!chatid) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'No chat ID provided' }),
        };
    }

    try {
        // Fetch the chat by its ID and populate modelResponses
        const chat = await ChatModel.findById(chatid)
            .populate('modelResponses')
            .lean(); 

        if (!chat) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Chat not found' }),
            };
        }

        // Prepare specific fields to return if needed
        const responseChat = {
            _id: chat._id,
            text: chat.text,
            modelResponses: chat.modelResponses,
            createdAt: chat.createdAt,
        };

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: "Chat fetched successfully",
                chat: responseChat, 
            }),
        };

    } catch (error) {
        console.error("Error fetching chat by id:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Server error while fetching chat',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            }),
        };
    }
};