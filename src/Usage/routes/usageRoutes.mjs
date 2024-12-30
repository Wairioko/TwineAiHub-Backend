import { verifyToken } from "../../Users/auth.mjs";
import { TokenUsage } from "../controller/usageController.mjs";
import express from 'express';


const router = express.Router();


router.get('/api/usage', verifyToken, TokenUsage);


export default router;