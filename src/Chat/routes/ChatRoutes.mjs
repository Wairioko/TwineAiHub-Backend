import { findAllModelResponses, problemController, 
    getChatDetails, handleSolveProblem , RegenerateModelResponse,
     GetChatsHistory, 
    GetChatById, DeleteChat, EditUserMessageResponse} from "../controllers/ChatControllers.mjs";
import express from "express";
import { verifyToken } from "../../Users/auth.mjs";
import { rateLimiter } from "../../middleware/rateLimiter.mjs";
import { s3Service } from "../../utils/s3Config.mjs";
import { authCorsMiddleware } from "../../Users/routes/UserRoutes.mjs";
const router = express.Router();



router.post(
    '/api/assistant/analyze',
    verifyToken,
    rateLimiter,
    s3Service.upload.single('file'), authCorsMiddleware,
    problemController.analyzeProblem.bind(problemController)
);


router.post('/api/chat/solve', verifyToken, authCorsMiddleware,s3Service.upload.single('file'), rateLimiter, handleSolveProblem);
router.get('/api/chat/:chatId',verifyToken, authCorsMiddleware,getChatDetails);
router.get('/api/chat/find/:id',verifyToken, authCorsMiddleware,findAllModelResponses);
router.post('/api/chat/feedback',verifyToken, authCorsMiddleware,rateLimiter,RegenerateModelResponse)
router.get('/api/user/history', verifyToken, authCorsMiddleware,GetChatsHistory)
router.get('/api/chat/:chatid/:name', verifyToken,authCorsMiddleware,rateLimiter, GetChatById)
router.delete('/api/chat/:chatid', verifyToken,authCorsMiddleware, DeleteChat)
router.put('/api/chat/edit', verifyToken,authCorsMiddleware,rateLimiter, EditUserMessageResponse)


export default router;

