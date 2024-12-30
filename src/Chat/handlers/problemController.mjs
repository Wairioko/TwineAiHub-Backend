import { fileProcessor } from "../../utils/fileProcessing.mjs";
import { ProblemStatementModel } from "../schema/ChatSchema.mjs";
import { AssistantBreakdownModel } from "../schema/ChatSchema.mjs";
import { s3Service } from "../../utils/s3Config.mjs";


class ProblemController {
    async analyzeProblem(event) {
        try {
            // Token verification helper function
            const verifyToken = (token) => {
                try {
                    return jwt.verify(token, process.env.JWT_SECRET);
                } catch (error) {
                    return null;
                }
            };

            // get tokens from cookies
            const authToken = event.cookies.authToken;
            const anonToken = event.cookies.anonToken;
            let user = null;

            // Decode token
            if (authToken) {
                user = verifyToken(authToken);
            } else if (anonToken) {
                user = verifyToken(anonToken);
            }

            if (!user) {
                return {
                    statusCode: 401,
                    body: JSON.stringify({ message: "Invalid authentication or anonymous token" })
                };
            }

            event.user = user;

            const { problemStatement } = event.body;

            if (!problemStatement?.trim()) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ message: "Problem statement is required" })
                };
            }

            // Process uploaded file if present
            let fileData = null;
            let fileContent = null;
            if (event.file) {
                const processedFile = await fileProcessor.handleFileUpload(event);
                fileData = processedFile.fileData;
                fileContent = processedFile.fileContent;
            }

            const userId = user.userId;
            const newProblemData = {
                description: problemStatement.trim(),
                attachedFile: fileData,
                anonymous: user.anonymous,
                ...(user.anonymous ? { anonymousAuthor: userId } : { registeredAuthor: userId })
            };

            // Save new problem statement
            const newProblem = await ProblemStatementModel.create(newProblemData);

            // Prepare assistant messages
            const messages = [
                {
                    role: 'system',
                    content: 'You are an experienced problem solver and project manager. Analyze the problem and attached document content if provided. Break down the solution into 3 parts and assign them to ChatGPT, Claude, and Gemini based on each model\'s strengths.'
                },
                { role: 'user', content: problemStatement }
            ];

            if (fileContent) {
                messages.push({ role: 'user', content: fileContent });
            }

            // Call OpenAI to analyze the problem
            const problemToAssistant = await openai.chat.completions.create({
                messages,
                model: 'gpt-4o-mini'
            });

            const assistantAnalysis = new AssistantBreakdownModel({
                chatGptId: problemToAssistant.id,
                problemStatement: newProblem._id,
                modelRoles: problemToAssistant.choices[0].message.content
            });

            await assistantAnalysis.save();

            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: "Problem saved and analyzed",
                    analysis: problemToAssistant.choices[0].message.content
                })
            };

        } catch (error) {
            console.error('Error during problem analysis:', error);

            // Clean up file from S3 if upload was unsuccessful
            if (event.file?.key) {
                try {
                    await s3Service.deleteFile(event.file.key);
                } catch (deleteError) {
                    console.error('Failed to delete file from S3:', deleteError);
                }
            }

            return {
                statusCode: 500,
                body: JSON.stringify({
                    message: "Error occurred while analyzing the problem",
                    error: error.message,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                })
            };
        }
    }
}


export const problemController = new ProblemController();

