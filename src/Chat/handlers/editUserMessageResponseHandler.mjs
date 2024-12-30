import { connectToDatabase } from "../../utils/constants.mjs";
import { ChatModel } from "../schema/ChatSchema.mjs";
import { ModelResponse } from "../schema/ChatSchema.mjs";
import mongoose from "mongoose";
import { callModelAPI } from "../../utils/helperFunctions.mjs";


export const editUserMessageResponseHandler = async (event) => {
    await connectToDatabase();

    const { chatId, modelName, oldResponse, newText } = JSON.parse(event.body);
    const user = event.requestContext?.authorizer?.user; // Assuming user info is available in the authorizer
    if (!user) {
        return {
            statusCode: 401,
            body: JSON.stringify({ message: "Unauthorized" }),
        };
    }

    // Validate input
    if (!chatId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "No ChatId" }),
        };
    }

    if (!newText) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "No New Text" }),
        };
    }

    if (!oldResponse) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "No Old Response" }),
        };
    }

    try {
        // Properly handle ObjectId conversion
        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Invalid ChatId" }),
            };
        }

        // Find the chat by ObjectId
        const findChat = await ChatModel.findById(chatId);

        if (!findChat) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "Chat not found" }),
            };
        }

        // Correctly populate the model responses
        const chat = await findChat.populate('modelResponses');

        // Find the index of the response being edited
        const responseIndex = chat.modelResponses.findIndex((response) => response._id.toString() === oldResponse);

        if (responseIndex === -1) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "Response not found" }),
            };
        }

        // Get the responses to be removed (all responses after the edited one)
        const responsesToRemove = chat.modelResponses.slice(responseIndex + 1);

        // Remove these responses from the database
        await ModelResponse.deleteMany({
            _id: { $in: responsesToRemove.map((r) => r._id) },
        });

        // Remove these responses from the chat's modelResponses array
        chat.modelResponses = chat.modelResponses.slice(0, responseIndex + 1);

        let prompt = '';
        const lastResponse = chat.modelResponses[responseIndex];

        if (lastResponse?.responses?.response) {
            prompt += `Your previous response: ${lastResponse.responses.response}\nFeedback: ${newText}`;
        }

        // Call model API to generate a new response
        const newResponse = await callModelAPI(modelName, prompt, { userid: user.userId });

        // Update the model response
        const updatedModelResponse = await ModelResponse.findByIdAndUpdate(
            oldResponse,
            {
                role: newText,
                responses: { response: newResponse },
            },
            { new: true }
        );

        // Update the chat document with the new response
        await chat.save();

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Response edited and subsequent responses removed",
                updatedResponse: updatedModelResponse,
            }),
        };
    } catch (error) {
        console.error('Error editing response:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "An error occurred while editing response",
                error: error.message,
            }),
        };
    }
};

