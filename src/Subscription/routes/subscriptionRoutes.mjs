import express from 'express';
import { handlePaddleWebhook, confirmSubscription } from '../controller/subscriptionController.mjs';


const router = express.Router();


// Webhook endpoint (no authentication required)
router.post('/webhook', handlePaddleWebhook);


router.post('/api/subscription/confirm', confirmSubscription);


export default router;

