import { getCache, setCache } from "../../utils/helperFunctions.mjs";
import mongoose from "mongoose";
import { UserModel } from "../../Users/schema/Users.mjs";


export const getChatsHistoryHandler = async (event) => {
    await connectToDatabase();
    
    const user = JSON.parse(event.body).user; // Assuming the user data is sent in the event body

    // Validate the user ID
    if (!user || !mongoose.isValidObjectId(user.userId)) {
        return {
            statusCode: 401,
            body: JSON.stringify({ message: 'Unauthorized Access' }),
        };
    }

    try {
        // Try to get from cache first
        const cacheKey = `chats:${user.userId}`;
        const cachedChats = await getCache(cacheKey);

        if (cachedChats) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    message: "Chats fetched from cache",
                    chats: cachedChats
                }),
            };
        }

        // If not in cache, get from database
        const findUser = await UserModel.findById(user.userId).populate({
            path: 'chats',
            populate: [
                { path: 'modelResponses' },
                { path: 'userProblemBreakdown' },
                { path: 'problemStatement' },
                { path: 'assistantProblemBreakdown' },
            ]
        });

        if (!findUser) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'User not found' }),
            };
        }

        const chats = findUser.chats.sort((a, b) => 
            new Date(b.updatedAt) - new Date(a.updatedAt)
        );

        // Set in cache
        await setCache(cacheKey, chats);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: "Chats fetched from database",
                chats
            }),
        };

    } catch (error) {
        console.error("Error fetching chats history:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Server error fetching chats history" }),
        };
    }
};

