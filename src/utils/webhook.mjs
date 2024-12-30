import express from 'express';
import crypto from 'crypto';

const router = express.Router();

const verifyPaddleWebhook = (req) => {
  // Get the raw body and Paddle signature
  const signature = req.headers['paddle-signature'];
  const rawBody = req.rawBody;

  // Your public key from Paddle
  const publicKey = process.env.PADDLE_PUBLIC_KEY;

  const verified = crypto.verify(
    'sha1',
    Buffer.from(rawBody),
    publicKey,
    Buffer.from(signature, 'base64')
  );

  return verified;
};

// Webhook handler middleware
const webhookHandler = async (req, res) => {
  try {
    // Verify the webhook
    if (!verifyPaddleWebhook(req)) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const { alert_name, ...data } = req.body;

    // Handle different webhook events
    switch (alert_name) {
      case 'subscription_created':
        await handleSubscriptionCreated(data);
        break;
      case 'subscription_cancelled':
        await handleSubscriptionCancelled(data);
        break;
      case 'subscription_payment_succeeded':
        await handlePaymentSucceeded(data);
        break;
      case 'subscription_payment_failed':
        await handlePaymentFailed(data);
        break;
      // Add more webhook handlers as needed
    }

    res.json({ status: 'success' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

router.post('/webhook', express.raw({ type: 'application/json' }), webhookHandler);

export default router;