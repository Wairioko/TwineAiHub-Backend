import jwt from 'jsonwebtoken'
import { connectToDatabase } from '../../utils/constants.mjs'
import { ProblemStatementModel } from '../schema/ChatSchema.mjs'
import { SolveProblemBreakdownModel } from '../schema/ChatSchema.mjs'
import { UserModel } from '../../Users/schema/Users.mjs'
import { ChatModel } from '../schema/ChatSchema.mjs'
import { fileProcessor } from '../../utils/fileProcessing.mjs'
import { getSignedFileUrl } from '../../utils/s3Service.mjs'
import { processModels } from '../../utils/helperFunctions.mjs'


export const handleSolveProblem = async (event) => {
    await connectToDatabase();

    const { problemStatement, modelAssignments } = JSON.parse(event.body);
    const authToken = event.headers['Cookie']?.split('; ').find(cookie => cookie.startsWith('authToken'))?.split('=')[1];
    const anonToken = event.headers['Cookie']?.split('; ').find(cookie => cookie.startsWith('anonToken'))?.split('=')[1];

    let user = null;

    // Decode the appropriate token
    if (authToken) {
        try {
            user = jwt.verify(authToken, process.env.JWT_SECRET);
        } catch (error) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: "Invalid auth token" })
            };
        }
    } else if (anonToken) {
        try {
            user = jwt.verify(anonToken, process.env.JWT_SECRET);
        } catch (error) {
            return {
                statusCode: 401,
                body: JSON.stringify({ message: "Invalid anonymous token" })
            };
        }
    }

    const userid = user.userId;

    if (!problemStatement) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Missing problem statement" })
        };
    }

    if (!Array.isArray(modelAssignments) || modelAssignments.length === 0) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "No roles selected for models" })
        };
    }

    let problemStatementDoc;
    let fileData = null;
    let fileContent = null;

    try {
        // Check if ProblemStatement exists
        problemStatementDoc = await ProblemStatementModel.findOne({
            description: problemStatement,
            ...(user.anonymous ? { anonymousAuthor: userid } : { registeredAuthor: userid })
        });

        // File processing
        if (problemStatementDoc && problemStatementDoc.attachedFile) {
            fileData = problemStatementDoc.attachedFile;

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
                    fileContent = null;
                }
            }
        } else if (event.body.file) {
            // New file upload
            try {
                const uploadResult = await fileProcessor.handleFileUpload(event);
                fileData = uploadResult.fileData;
                fileContent = uploadResult.fileContent;
            } catch (uploadError) {
                console.error('Error processing file upload:', uploadError);
                fileData = null;
                fileContent = null;
            }
        }

        // Create or use existing ProblemStatement
        if (!problemStatementDoc) {
            problemStatementDoc = new ProblemStatementModel({
                description: problemStatement,
                attachedFile: fileData,
                ...(user.anonymous ? { anonymousAuthor: userid } : { registeredAuthor: userid }),
                anonymous: user.anonymous
            });
            await problemStatementDoc.save();
        }

        // Create problem breakdown
        const createUserProblem = new SolveProblemBreakdownModel({
            problemStatement: problemStatementDoc._id,
            modelRoles: modelAssignments,
            ...(user.anonymous ? { anonymousAuthor: userid } : { registeredAuthor: userid })
        });
        await createUserProblem.save();

        // Create chat document
        const newChat = new ChatModel({
            problemStatement: problemStatementDoc._id,
            userProblemBreakdown: createUserProblem._id,
            ...(user.anonymous ? { anonymousAuthor: userid } : { registeredAuthor: userid })
        });
        await newChat.save();

        // Update user's chat list for registered users
        if (!user.anonymous) {
            await UserModel.findByIdAndUpdate(
                userid,
                { $push: { chats: newChat._id } },
                { new: true }
            );
        }

        // Process models asynchronously
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

        // Generate signed URL for file if exists
        let fileUrl = null;
        if (fileData && fileData.key) {
            try {
                fileUrl = await getSignedFileUrl(fileData.key);
            } catch (urlError) {
                console.error('Error generating signed URL:', urlError);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Problem processing initiated successfully",
                chatId: newChat._id,
                fileUrl: fileUrl
            }),
        };

    } catch (error) {
        console.error("Error in handleSolveProblem:", error);

        // Cleanup S3 file if error occurs
        if (fileData?.key && !problemStatementDoc) {
            try {
                await s3Service.deleteFile(fileData.key);
            } catch (deleteError) {
                console.error('Failed to delete file from S3 during error cleanup:', deleteError);
            }
        }

        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Error occurred while processing the problem",
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }),
        };
    }
};


