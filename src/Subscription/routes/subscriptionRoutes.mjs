import express from 'express';
import { SubscriptionController } from '../controller/subscriptionController.mjs';


const router = express.Router();


// Webhook endpoint (no authentication required)
router.post('/webhook', express.raw({ type: 'application/json' }),
 SubscriptionController.handleWebhook);


// Protected routes (require authentication)


router.get('/api/subscription/details', SubscriptionController.getSubscriptionDetails);
// router.get('/api/subscription/payments', SubscriptionController.getPaymentHistory);
router.post('/api/subscription/cancel', SubscriptionController.cancelSubscription);


export default router;

