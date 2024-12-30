import { ChatModel } from "../schema/ChatSchema.mjs";
import { ProblemStatementModel } from "../schema/ChatSchema.mjs";
import { ModelResponse } from "../schema/ChatSchema.mjs";
import { fileProcessor } from "../../utils/fileProcessing.mjs";
import { getSignedFileUrl } from "../../utils/s3Service.mjs";
import { connectToDatabase } from "../../utils/constants.mjs";
import { callModelAPI } from "../../utils/helperFunctions.mjs";


export const regenerateModelResponse = async (event) => {
    await connectToDatabase();

    const { modelName, chatId, feedback } = JSON.parse(event.body);
    const user = event.requestContext?.authorizer?.user;
    const isAnonymous = user?.anonymous;

    if (!chatId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "No ChatId provided" }),
        };
    }

    if (!modelName) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "No Model Name provided" }),
        };
    }

    if (!feedback) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "No Feedback provided" }),
        };
    }

    try {
        const chat = await ChatModel.findById(chatId)
            .populate('userProblemBreakdown')
            .populate('modelResponses')
            .populate({
                path: 'problemStatement',
                populate: {
                    path: 'attachedFile',
                },
            });

        if (!chat) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "Chat not found" }),
            };
        }

        const problemStatement = await ProblemStatementModel.findById(chat.problemStatement._id);
        if (!problemStatement) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "Problem statement not found" }),
            };
        }

        let fileContent = null;
        const fileData = problemStatement.attachedFile;

        if (fileData && fileData.key) {
            try {
                const mime = fileData.mimetype || fileProcessor.getMimeType(fileData.key);
                fileContent = await fileProcessor.getFileContent({
                    key: fileData.key,
                    mimetype: mime,
                    originalname: fileData.originalname || fileData.key.split('/').pop(),
                });
            } catch (fileError) {
                console.error('Error getting file content:', fileError);
            }
        }

        const lastResponse = chat.modelResponses
            .filter((response) => response.modelName === modelName)
            .pop();

        let prompt = `I have this problem: ${problemStatement.description}\n`;
        if (fileContent) {
            prompt += `\nRelated file content:\n${fileContent}\n`;
        }
        if (lastResponse?.responses?.response) {
            prompt += `\nYour previous response: ${lastResponse.responses.response}\nFeedback: ${feedback}, write how you'll fix it, then give me a new solution.`;
        }

        const userid = user.userId;
        const newResponse = await callModelAPI(modelName, prompt, userid, fileContent, isAnonymous);

        const newModelResponse = new ModelResponse({
            modelName,
            role: feedback,
            responses: { response: newResponse },
        });

        await newModelResponse.save();
        chat.modelResponses.push(newModelResponse);
        await chat.save();

        let fileUrl = null;
        if (fileData?.key) {
            try {
                fileUrl = await getSignedFileUrl(fileData.key);
            } catch (urlError) {
                console.error('Error generating signed URL:', urlError);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: "New model response generated and saved",
                response: newResponse,
                fileUrl,
            }),
        };
    } catch (error) {
        console.error("Error generating model response:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Error generating model response" }),
        };
    }
};

