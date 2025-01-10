import express from 'express';
import { handlePaddleWebhook, confirmSubscription } from '../controller/subscriptionController.mjs';


const router = express.Router();


// Webhook endpoint (no authentication required)
router.post('/webhook', handlePaddleWebhook);


router.get('/api/subscription/confirm', confirmSubscription);


export default router;

