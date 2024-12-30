import { ChatModel } from "../schema/ChatSchema.mjs";
import { connectToDatabase } from "../../utils/constants.mjs";


export const deleteChatHandler = async (event) => {
    await connectToDatabase();
    const { chatid } = event.pathParameters;
    
    try {
        if (!chatid) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Chat ID not provided' }),
            };
        }

        const deletedChat = await ChatModel.findByIdAndDelete(chatid);

        if (!deletedChat) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Chat not found' }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Chat deleted successfully' }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Server error while deleting chat',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            }),
        };
    }
};
