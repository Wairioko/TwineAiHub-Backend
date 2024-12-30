import { ProblemStatementModel, ModelResponse ,SolveProblemBreakdownModel, AssistantBreakdownModel ,ChatModel } from "../schema/ChatSchema.mjs"
import dotenv from 'dotenv';
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';
import { UserModel } from "../../Users/schema/Users.mjs";
import mongoose from "mongoose";
import { UserBillingModel } from "../../Usage/schema/tokenSchema.mjs";
import redis from 'redis';
import {EventEmitter} from "events"
import { s3Service } from "../../utils/s3Config.mjs";
import { fileProcessor } from "../../utils/fileProcessing.mjs";
import { getSignedFileUrl } from "../../utils/s3Service.mjs";
import jwt from 'jsonwebtoken'
import { setCache, getCache, parseCookies } from "../../utils/helperFunctions.mjs";



dotenv.config()

// init openai
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
})

// init google gemini
const Google_Gemini_KEY = process.env.Google_Gemini_KEY
const Google_Gemini = new GoogleGenerativeAI(Google_Gemini_KEY);

const Gemini_model = Google_Gemini.getGenerativeModel({ model: "gemini-1.5-flash" })

// init claude ai key
const Claude_Key = process.env.Claude_Key

const Claude = new Anthropic({
    apiKey: Claude_Key
})



// Redis client configuration
// const redisClient = redis.createClient({
//     url: process.env.REDIS_URL || 'redis://localhost:6379',
//     socket: {
//         reconnectStrategy: (retries) => {
//             if (retries > 10) {
//                 return new Error('Redis connection retries exhausted');
//             }
//             // Reconnect after n seconds
//             return Math.min(retries * 100, 3000);
//         }
//     }
// });

// // Initialize Redis connection
// const initRedis = async () => {
//     try {
//         await redisClient.connect();
//         console.log('Redis connected successfully');
//     } catch (error) {
//         console.error('Redis connection error:', error);
//         // Continue without Redis - fallback to direct DB queries
//     }
// };

// initRedis();






function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

async function callOpenAIAPI(prompt, userid, fileContent, isAnonymous) {
    try {
        const response = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are a an experienced problem solver and assistant' },
                { role: 'user', content: `${prompt}`},
                { role: 'user', content: `the data ${fileContent}`}
            ],
            model: 'gpt-4o-mini',
        });

        // Only update billing if userid is valid
        if (userid) {
            const tokenUsageEntry = {
                modelName: 'ChatGpt',
                date: new Date(),
                inputTokens: response.usage.prompt_tokens,
                outputTokens: response.usage.completion_tokens,
            };
            if(!isAnonymous=== true){
            await UserBillingModel.findOneAndUpdate(
                { user: new mongoose.Types.ObjectId(userid) }, 
                { $push: { tokenUsage: tokenUsageEntry } },
                { new: true, upsert: true }
            )}else{
                await UserBillingModel.findOneAndUpdate(
                { anonymousUser: userid }, 
                { $push: { tokenUsage: tokenUsageEntry } },
                { new: true, upsert: true })
            }

        }
        
        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error in callOpenAIAPI:', error);
        throw error;
    }
}

async function callClaudeAPI(prompt, userid, fileContent, isAnonymous) {
    console.log("this is the user from claude", userid);
    
    try {
        const response = await Claude.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 2048,
            messages: [
                { role: "user", content: prompt }, 
                { role: 'user', content: `the data ${fileContent}`}
            ],
        });

        // Extract token usage and update billing only if userid is valid
        if (response.usage && response.usage.input_tokens && response.usage.output_tokens && userid ) {
            const tokenUsageEntry = {
                modelName: 'Claude',
                date: new Date(),
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
            };

            if(!isAnonymous=== true){
                await UserBillingModel.findOneAndUpdate(
                    { user: new mongoose.Types.ObjectId(userid) }, 
                    { $push: { tokenUsage: tokenUsageEntry } },
                    { new: true, upsert: true }
                )}else{
                    await UserBillingModel.findOneAndUpdate(
                    { anonymousUser: userid }, 
                    { $push: { tokenUsage: tokenUsageEntry } },
                    { new: true, upsert: true })
            }
        }

        // Handle response content
        if (Array.isArray(response.content)) {
            const textObject = response.content.find(item => item.type === 'text');
            if (textObject) {
                return textObject.text;
            }
        } else if (typeof response.content === 'object') {
            if (response.content.type === 'text') {
                return response.content.text;
            }
            return JSON.stringify(response.content);
        } else if (typeof response.content === 'string') {
            return response.content;
        }
        return JSON.stringify(response.content);
    } catch (error) {
        console.error(`Error in callClaudeAPI:`, error);
        throw error;
    }
}


async function callGeminiAPI(prompt, userid, fileContent, isAnonymous) {
    console.log("this is the user from gemini", userid);
    
    try {
        const completePrompt = `${prompt} and the data ${fileContent}`;
        const response = await Gemini_model.generateContent(completePrompt);
        
        // Only update billing if userid is valid
        if (userid) {
            const tokenUsageEntry = {
                modelName: 'Gemini',
                date: new Date(),
                inputTokens: response.response.usageMetadata.promptTokenCount,
                outputTokens: response.response.usageMetadata.candidatesTokenCount,
            }

            if(!isAnonymous=== true){
                await UserBillingModel.findOneAndUpdate(
                    { user: new mongoose.Types.ObjectId(userid) }, 
                    { $push: { tokenUsage: tokenUsageEntry } },
                    { new: true, upsert: true }
                )}else{
                    await UserBillingModel.findOneAndUpdate(
                    { anonymousUser: userid }, 
                    { $push: { tokenUsage: tokenUsageEntry } },
                    { new: true, upsert: true })
            }
        }
        
        return response.response.text();
    } catch (error) {
        console.error('Error in callGeminiAPI:', error);
        throw error;
    }
}


const callModelAPI = async (modelName, prompt, userid, fileContent, isAnonymous) => {
    let response;
    try {
        switch(modelName) {
            case 'ChatGpt':
                response = await callOpenAIAPI(prompt, userid, fileContent, isAnonymous);
                break;
            case 'Claude':
                response = await callClaudeAPI(prompt, userid, fileContent, isAnonymous);
                break;
            case 'Gemini':
                response = await callGeminiAPI(prompt, userid, fileContent, isAnonymous);
                break;
            default:
                throw new Error(`Unsupported model: ${modelName}`);
        }

        if (typeof response === 'object') {
            if (response.text) {
                return response.text.trim();
            } else if (response.content) {
                return response.content.trim();
            }
            return JSON.stringify(response).trim();
        }
        return typeof response === 'string' ? response.trim() : String(response).trim();
        
    } catch (error) {
        console.error(`Error calling ${modelName} API:`, error);
        throw error;
    }
};


class ProblemController {
    async analyzeProblem(req, res) {
        let uploadedFileKey = null;

        try {
            // Parse cookies for authentication
            const cookies = req.headers.cookie || '';
            const parsedCookies = parseCookies(cookies);

            const { authToken, anonToken } = parsedCookies;
            
          
            let user = null;

            // Verify auth token first
            if (authToken) {
                try {
                    user = jwt.verify(authToken, process.env.JWT_SECRET);
                    user.anonymous = false;
                } catch (error) {
                    console.warn("Auth token verification failed:", error.message);
                }
            }

            // If no authenticated user, try anonymous token
            if (!user && anonToken) {
                try {
                    user = jwt.verify(anonToken, process.env.JWT_SECRET);
                    user.anonymous = true;
                } catch (error) {
                    console.warn("Anon token verification failed:", error.message);
                    return res.status(401).json({
                        message: "Authentication failed - Please refresh the page",
                        error: "INVALID_TOKEN",
                    });
                }
            }

           
            // Attach user information to the request
            req.user = user;
            console.log("User information attached to request", req.user);

            // Validate problem statement
            const { problemStatement } = req.body;
            if (!problemStatement?.trim()) {
                return res.status(400).json({ message: "Problem statement is required" });
            }

            // File-related initialization
            let fileData = null;
            let fileContent = null;

            if (req.file) {
                // Process uploaded file
                try {
                    const processedFile = await fileProcessor.handleFileUpload(req.file);
                    fileData = processedFile.fileData;
                    fileContent = processedFile.fileContent;
                    uploadedFileKey = req.file.key; // For cleanup if needed
                } catch (fileError) {
                    console.error("File processing error:", fileError);
                    // Proceed without file if processing fails
                    fileData = null;
                    fileContent = null;
                }
            }

            const userId = user.userId || user._id;
            console.log("User ID:", userId);
            const newProblemData = {
                description: problemStatement.trim(),
                anonymous: user.anonymous,
                ...(user.anonymous
                    ? { anonymousAuthor: userId }
                    : { registeredAuthor: userId }),
            };

            console.log("newProblemData:", newProblemData)

            // Save problem statement
            const newProblem = await ProblemStatementModel.create(newProblemData);

            // Prepare assistant analysis messages
            const messages = [
                {
                    role: "system",
                    content:
                        "You are an experienced problem solver and project manager. Analyze the problem and attached document content if provided. Break down the solution into 3 parts and assign them to ChatGpt, Claude, and Gemini based on each model's strengths.",
                },
                { role: "user", content: problemStatement },
            ];

            if (fileContent) {
                messages.push({ role: "user", content: fileContent });
            }

            // Analyze problem with assistant
            const problemToAssistant = await openai.chat.completions.create({
                messages,
                model: "gpt-4o-mini",
            });

            const assistantAnalysis = new AssistantBreakdownModel({
                chatGptId: problemToAssistant.id,
                problemStatement: newProblem._id,
                modelRoles: problemToAssistant.choices[0].message.content,
            });

            await assistantAnalysis.save();

            return res.status(200).json({
                message: "Problem saved and analyzed",
                analysis: problemToAssistant.choices[0].message.content,
                hasAttachment: !!fileData, // Flag indicating file presence
            });
        } catch (error) {
            console.error("Error during problem analysis:", error);

            // Cleanup: Delete uploaded file if it exists and there was an error
            if (uploadedFileKey) {
                try {
                    await s3Service.deleteFile(uploadedFileKey);
                } catch (deleteError) {
                    console.error("Failed to delete file from S3:", deleteError);
                }
            }

            return res.status(500).json({
                message: "An error occurred while processing your request",
                error: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
            });
        }
    }
}

export const problemController = new ProblemController();



let processedModelCount = 0;


export const handleSolveProblem = async (req, res) => {
    const { problemStatement, modelAssignments } = req.body;
    // get tokens from cookies
    const cookies = req.headers.cookie || '';
    const parsedCookies = parseCookies(cookies);

    const { authToken, anonToken } = parsedCookies;

    let user = null;

    // Verify auth token first
    if (authToken) {
        try {
            user = jwt.verify(authToken, process.env.JWT_SECRET);
            user.anonymous = false;
        } catch (error) {
            console.warn("Auth token verification failed:", error.message);
        }
    }

    // If no authenticated user, try anonymous token
    if (!user && anonToken) {
        try {
            user = jwt.verify(anonToken, process.env.JWT_SECRET);
            user.anonymous = true;
        } catch (error) {
            console.warn("Anon token verification failed:", error.message);
            return res.status(401).json({
                message: "Authentication failed - Please refresh the page",
                error: "INVALID_TOKEN",
            });
        }
    }

    // If no user was found through either token
    if (!user) {
        return res.status(401).json({
            message: "No valid authentication found",
            error: "NO_AUTH",
        });
    }

    // Attach user information to the request
    req.user = user;

    const userid = user.userId;


    if (!problemStatement) {
        return res.status(400).send({ message: "Missing problem statement" });
    }

    if (!Array.isArray(modelAssignments) || modelAssignments.length === 0) {
        return res.status(400).send({ message: "No roles selected for models" });
    }

    let problemStatementDoc;
    let fileData = null;
    let fileContent = null;

    try {
        // check if ProblemStatement exists
        problemStatementDoc = await ProblemStatementModel.findOne({
            description: problemStatement,
            ...(user.anonymous ? { anonymousAuthor: userid } : { registeredAuthor: userid })
        });

        // file processing
        if (problemStatementDoc && problemStatementDoc.attachedFile) {
         
            fileData = problemStatementDoc.attachedFile;

            if (fileData && fileData.key) {
                try {
                    // find mime type from stored data or file extension
                    const mime = fileData.mimetype || fileProcessor.getMimeType(fileData.key);
                    
                    fileContent = await fileProcessor.getFileContent({
                        key: fileData.key,
                        mimetype: mime,
                        originalname: fileData.originalname || fileData.key.split('/').pop()
                    });
                    
                } catch (fileError) {
                    console.error('Error getting file content:', fileError);
                    fileContent = null;
                }
            }
        } else if (req.file) {
            // new file upload
            try {
                const uploadResult = await fileProcessor.handleFileUpload(req);
                fileData = uploadResult.fileData;
                fileContent = uploadResult.fileContent;
            } catch (uploadError) {
                console.error('Error processing file upload:', uploadError);
                // continue without file if upload fails
                fileData = null;
                fileContent = null;
            }
        }

        // create or use existing ProblemStatement
        if (!problemStatementDoc) {
            problemStatementDoc = new ProblemStatementModel({
                description: problemStatement,
                attachedFile: fileData,
                ...(user.anonymous ? { anonymousAuthor: userid } : { registeredAuthor: userid }),
                anonymous: user.anonymous
            });
            await problemStatementDoc.save();
           
        }

        // create problem breakdown
        const createUserProblem = new SolveProblemBreakdownModel({
            problemStatement: problemStatementDoc._id,
            modelRoles: modelAssignments,
            ...(user.anonymous ? { anonymousAuthor: userid } : { registeredAuthor: userid })
        });
        console.log("user problem", createUserProblem)
        await createUserProblem.save();
        
        // create chat doc
        const newChat = new ChatModel({
            problemStatement: problemStatementDoc._id,
            userProblemBreakdown: createUserProblem._id,
            ...(user.anonymous ? { anonymousAuthor: userid } : { registeredAuthor: userid })
        });
        console.log("new chat", newChat)
        await newChat.save();
        

        // update user's chat list for registered users
        if (!user.anonymous) {
            await UserModel.findByIdAndUpdate(
                userid, 
                { $push: { chats: newChat._id } }, 
                { new: true }
            );
           
        }
        
        // process models asynchronously
        processModels(
            problemStatementDoc.description, 
            modelAssignments, 
            newChat._id, 
            {
                userid,
                isAnonymous: user.anonymous,
                fileKey: fileData?.key,
                fileContent: fileContent
            }
        ).catch(error => {
            console.error("Error processing models:", error);
            
        });
      
        // generate signed URL for file if exists
        let fileUrl = null;
        if (fileData && fileData.key) {
            try {
                fileUrl = await getSignedFileUrl(fileData.key);
            } catch (urlError) {
                console.error('Error generating signed URL:', urlError);
                
            }
        }
        console.log("chatId", newChat._id);
        // Send success response
        return res.status(200).json({
            message: "Problem processing initiated successfully",
            chatId: newChat._id,
            fileUrl: fileUrl
        });

    } catch (error) {
        console.error("Error in handleSolveProblem:", error);
        
       
        if (fileData?.key && !problemStatementDoc) {
            try {
                await s3Service.deleteFile(fileData.key);
                
            } catch (deleteError) {
                console.error('Failed to delete file from S3 during error cleanup:', deleteError);
            }
        }

        return res.status(500).send({ 
            message: "Error occurred while processing the problem", 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};


const modelProcessingEmitter = new EventEmitter();


async function processModels(problemStatement, modelAssignments, chatId, options) {
    let modelResponses = {};
    const { userid, fileKey, fileContent, isAnonymous } = options;
 
    for (const modelRole of modelAssignments) {
        const { model: modelName, role } = modelRole;
        
        let prompt = `Problem: ${problemStatement}\nYour role in solving this: ${role}\n, data for this ${fileContent}, if no data present ignore as its not required therefore`;
        

        // append the responses of previous models to prompt for next model to get context before building
        if (Object.keys(modelResponses).length > 0) {
            prompt += "\nPrevious model responses:\n";
            for (const [prevModel, prevResponse] of Object.entries(modelResponses)) {
                prompt += `The previous model (${prevModel}) gave the response: ${prevResponse.response}\n`;
            }
        }
        
        try {
           
            const response = await callModelAPI(modelName, prompt, userid, fileContent, isAnonymous);
            console.log("the response from model processing", response)
            // cache model response for use by future models
            modelResponses[modelName] = { response };

            // save to the database
            const modelResponse = new ModelResponse({
                modelName,
                role,
                responses: { response }
            });
            await modelResponse.save();

            console.log("the model response", modelResponse)

            // update the corresponding chat with the response of this model
            await ChatModel.findByIdAndUpdate(
                chatId,
                { $push: { modelResponses: modelResponse._id } }
            );

            //  notifying other clients
            modelProcessingEmitter.emit('modelProcessed', { modelName, chatId });

        } catch (modelError) {
            console.error(`Error processing model ${modelName}:`, modelError);
            
        }
    }


}


export const getChatDetails = async (req, res) => {
    try {
        const { chatId } = req.params;
        console.log('Fetching details for chat:', chatId);

        // Function to check processing status
        const checkProcessingStatus = async () => {
            const chat = await ChatModel.findById(chatId)
                .populate('modelResponses')
                .populate('userProblemBreakdown')
                .populate('problemStatement', 'description')
                .populate({
                    path: 'userProblemBreakdown',
                    populate: {
                        path: 'problemStatement',
                        select: 'description'
                    }
                });

            if (!chat) {
                return null;
            }

            const isProcessingComplete = chat.modelResponses.length > 0 &&
                chat.modelResponses.every((response) => response.completed);

            return {
                chat,
                isProcessingComplete
            };
        };

        // Initial check
        const initialStatus = await checkProcessingStatus();
        
        if (!initialStatus) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        if (initialStatus.isProcessingComplete) {
            // If processing is already complete, return immediately
            return res.status(200).json(initialStatus.chat);
        }

        // If processing is not complete, set up a listener for completion
        const processingTimeout = setTimeout(() => {
            modelProcessingEmitter.removeListener('modelProcessed', onModelProcessed);
            res.status(200).json(initialStatus.chat);
        }, 10000); // 10 second timeout

        const onModelProcessed = async () => {
            const currentStatus = await checkProcessingStatus();
            if (currentStatus && currentStatus.isProcessingComplete) {
                clearTimeout(processingTimeout);
                modelProcessingEmitter.removeListener('modelProcessed', onModelProcessed);
                res.status(200).json(currentStatus.chat);
            }
        };

        modelProcessingEmitter.on('modelProcessed', onModelProcessed);

        // Clean up in case of client disconnect
        req.on('close', () => {
            clearTimeout(processingTimeout);
            modelProcessingEmitter.removeListener('modelProcessed', onModelProcessed);
        });

    } catch (error) {
        console.error('Error fetching chat details:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const EditUserMessageResponse = async (req, res) => {
    const { chatId, modelName, oldResponse, newText } = req.body;
    const cookies = req.headers.cookie || '';
    const parsedCookies = parseCookies(cookies);

    const { authToken, anonToken } = parsedCookies;

    let user = null;

    // Verify auth token first
    if (authToken) {
        try {
            user = jwt.verify(authToken, process.env.JWT_SECRET);
            user.anonymous = false;
        } catch (error) {
            console.warn("Auth token verification failed:", error.message);
        }
    }

    // If no authenticated user, try anonymous token
    if (!user && anonToken) {
        try {
            user = jwt.verify(anonToken, process.env.JWT_SECRET);
            user.anonymous = true;
        } catch (error) {
            console.warn("Anon token verification failed:", error.message);
            return res.status(401).json({
                message: "Authentication failed - Please refresh the page",
                error: "INVALID_TOKEN",
            });
        }
    }

    // If no user was found through either token
    if (!user) {
        return res.status(401).json({
            message: "No valid authentication found",
            error: "NO_AUTH",
        });
    }

    // Attach user information to the request
    req.user = user;
   
    // Validate input
    if (!chatId) return res.status(404).send({ message: "No ChatId" });
    if (!newText) return res.status(404).send({ message: "No Role" });
    if (!oldResponse) return res.status(404).send({ message: "No ResponseId" });

    try {
        // Properly handle ObjectId conversion
        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).send({ message: "Invalid ChatId" });
        }
        // Find the chat by ObjectId
        const findChat = await ChatModel.findById(chatId);

        if (!findChat) return res.status(404).send({ message: "No Chat matching this id" });

        // Correctly populate the model responses
        const chat = await findChat.populate('modelResponses');

        // Find the index of the response being edited
        const responseIndex = chat.modelResponses.findIndex(response => response._id.toString() === oldResponse);

        if (responseIndex === -1) {
            return res.status(404).send({ message: "Response not found" });
        }

        // Get the responses to be removed (all responses after the edited one)
        const responsesToRemove = chat.modelResponses.slice(responseIndex + 1);
        console.log("the responses to be removed", responsesToRemove)

        // Remove these responses from the database
        await ModelResponse.deleteMany({
            _id: { $in: responsesToRemove.map(r => r._id) }
        });

        // Remove these responses from the chat's modelResponses array
        chat.modelResponses = chat.modelResponses.slice(0, responseIndex + 1);

        let prompt = '';

        const lastResponse = chat.modelResponses[responseIndex];
        if (lastResponse?.responses?.response) {
            prompt += `Your previous response: ${lastResponse.responses.response}\nFeedback: ${newText}`;
        }

        const newResponse = await callModelAPI(modelName, prompt, { userid: user.userId });

        // Update the model response
        const newModelResponse = await ModelResponse.findByIdAndUpdate(
            oldResponse,
            {
                role: newText,
                responses: { response: newResponse },
            },
            { new: true }
        );

        // Update the chat document
        await chat.save();

        return res.status(200).send({ 
            message: "Response edited and subsequent responses removed", 
            updatedResponse: newModelResponse 
        });
    } catch (error) {
        
        return res.status(500).send({ message: "Server error editing response" });
    }
};


export const RegenerateModelResponse = async (req, res) => {
    const { modelName, chatId, feedback } = req.body;
    if (!chatId) return res.status(400).send({ message: "No ChatId provided" });
    if (!modelName) return res.status(400).send({ message: "No Model Name provided" });
    if (!feedback) return res.status(400).send({ message: "No Feedback provided" });

    const user = req.user;
    const isAnonymous = req.user.anonymous

    try {
        // Fetch the chat with populated references
        const chat = await ChatModel.findById(chatId)
            .populate('userProblemBreakdown')
            .populate('modelResponses')
            .populate({
                path: 'problemStatement',
                populate: {
                    path: 'attachedFile'
                }
            });

        if (!chat) {
           
            return res.status(404).send({ message: "Chat not found" });
        }

        const problemStatement = await ProblemStatementModel.findById(chat.problemStatement._id);
        if (!problemStatement) {
            
            return res.status(404).send({ message: "Problem Statement not found" });
        }

        // Process file content if available
        let fileContent = null;
        const fileData = problemStatement.attachedFile;

        if (fileData && fileData.key) {
            try {
                const mime = fileData.mimetype || fileProcessor.getMimeType(fileData.key);
                fileContent = await fileProcessor.getFileContent({
                    key: fileData.key,
                    mimetype: mime,
                    originalname: fileData.originalname || fileData.key.split('/').pop()
                });
            } catch (fileError) {
                console.error('Error getting file content:', fileError);
            }
        }

        const lastResponse = chat.modelResponses.filter(response => response.modelName === modelName).pop();

        // Building a new prompt to include file response
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
            responses: { response: newResponse }
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

        return res.status(200).send({
            message: "New model response generated and saved",
            response: newResponse,
            fileUrl
        });
    } catch (error) {
        console.error("Error generating model response:", error);
        return res.status(500).send({ message: "Server error while generating new response" });
    }
};


export const findAllModelResponses = async (req, res) => {
    const {modelName, chatid} = req.body;
    if (!chatid) return res.status(404).send({ message: "No ChatId" });
    if (!modelName) return res.status(404).send({ message: "No Model Name Passed" });

    try {
        // Find the chat by ID
        const findChat = await ChatModel.findById(chatid);
        if (!findChat) return res.status(404).send({ message: "No Chat Found" });
        
        // Find the specific model response
        const findModelResponse = findChat.modelResponses.find(response => response.modelName === modelName);
        if (!findModelResponse) return res.status(404).send({ message: "No responses by this model found" });

        return res.status(200).send({message:"Model Responses Found"}, findModelResponse)


    }catch(error){
        res.status(500).send({message:"Server error finding model responses"})

    }

}



export const GetChatsHistory = async (req, res) => {
    const user = req.user;

    // Validate the user ID
    if (!mongoose.isValidObjectId(user.userId)) {
        return res.status(400).json({ 
            success: false, 
            message: "Invalid user ID" 
        });
    }

    try {
        // Try to get from cache first
        const cacheKey = `chats:${user.userId}`;
        const cachedChats = await getCache(cacheKey);
        
        if (cachedChats) {
            return res.status(200).json({
                success: true,
                message: "Chats fetched from cache",
                chats: cachedChats
            });
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
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const chats = findUser.chats.sort((a, b) => 
            new Date(b.updatedAt) - new Date(a.updatedAt)
        );

        // Set in cache
        await setCache(cacheKey, chats);

        return res.status(200).json({
            success: true,
            message: "Chats fetched successfully",
            chats
        });

    } catch (error) {
        console.error("Error fetching chats history:", error);
        return res.status(500).json({
            success: false,
            message: "Server error fetching chats history",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const GetChatById = async (req, res) => {
    const { chatid } = req.params;

    // Check if chatid is present
    if (!chatid) {
        return res.status(400).json({ message: "Chat ID not provided" });
    }

    try {
        // Fetch the chat by its ID and populate modelResponses
        const chat = await ChatModel.findById(chatid)
            .populate('modelResponses')
            .lean(); 

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        // You can choose to return specific fields if needed
        const responseChat = {
            _id: chat._id,
            
            text: chat.text,
            modelResponses: chat.modelResponses, 
            createdAt: chat.createdAt
        };

        return res.status(200).json({
            success: true,
            message: "Chat fetched successfully",
            chat: responseChat // Send the filtered response
        });

    } catch (error) {
        console.error("Error fetching chat by id:", error);
        return res.status(500).json({
            success: false,
            message: "Server error fetching chat",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


export const DeleteChat = async (req, res) => {
    const { chatid } = req.params; // Use req.params instead of req.query

    try {
        if (!chatid) {
            return res.status(400).json({ message: 'Chat id must be provided' });
        }

        const deletedChat = await ChatModel.findByIdAndDelete(chatid);

        if (!deletedChat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        return res.status(200).json({ message: 'Chat deleted successfully', chat: deletedChat });

    } catch (error) {
        console.error('Error deleting chat:', error);
        return res.status(500).json({ message: 'Server error deleting chat' });
    }
}

