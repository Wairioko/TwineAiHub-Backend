import { createHmac } from 'crypto';
import { Subscription } from '../models/subscription.js';
import { User } from '../models/user.js';
import { connectToDatabase } from '../../utils/constants.mjs';

// Utility functions
const verifyWebhookSignature = (rawBody, signature) => {
  const hmac = createHmac('sha256', process.env.PADDLE_PUBLIC_KEY)
    .update(rawBody)
    .digest('hex');
  return hmac === signature;
};

// Response helper
const createResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ['https://twineaihub.com', 'https://thirdman-frontend.vercel.app'],
    'Access-Control-Allow-Credentials': true,
  },
  body: JSON.stringify(body)
});

// Subscription status sync
async function syncSubscriptionStatus(data) {
  const {
    subscription_id,
    user_id,
    status,
    next_bill_date,
    update_url,
    cancel_url
  } = data;

  const subscription = await Subscription.findOneAndUpdate(
    { paddleSubscriptionId: subscription_id },
    {
      $set: {
        userId: user_id,
        status: status || 'active',
        currentPeriodEnd: new Date(next_bill_date),
        updateUrl: update_url,
        cancelUrl: cancel_url
      }
    },
    { upsert: true, new: true }
  );

  await User.findByIdAndUpdate(user_id, {
    subscriptionStatus: status || 'active',
    currentSubscription: subscription._id
  });

  return subscription;
}

// Lambda handlers
export const handleWebhook = async (event) => {
  try {
    await connectToDatabase();

    // Verify webhook signature
    const signature = event.headers['paddle-signature'];
    const rawBody = event.body;
    
    if (!verifyWebhookSignature(rawBody, signature)) {
      return createResponse(401, { error: 'Invalid webhook signature' });
    }

    const { alert_name, ...data } = JSON.parse(rawBody);

    switch (alert_name) {
      case 'subscription_created':
      case 'subscription_updated':
        await syncSubscriptionStatus(data);
        break;
        
      case 'subscription_cancelled':
        await handleSubscriptionCancelled(data);
        break;
        
      case 'subscription_payment_failed':
        await handlePaymentFailed(data);
        break;
    }

    return createResponse(200, { message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return createResponse(500, { error: 'Webhook processing failed' });
  }
};

export const getSubscriptionDetails = async (event) => {
  try {
    await connectToDatabase();

    const userId = event.requestContext.authorizer.principalId; // Assuming you're using a custom authorizer

    const subscription = await Subscription.findOne({ userId })
      .sort({ createdAt: -1 });

    if (!subscription) {
      return createResponse(404, { error: 'No subscription found' });
    }

    return createResponse(200, subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return createResponse(500, { error: 'Failed to fetch subscription details' });
  }
};

export const getCancellationUrl = async (event) => {
  try {
    await connectToDatabase();

    const userId = event.requestContext.authorizer.principalId;

    const subscription = await Subscription.findOne({
      userId,
      status: 'active'
    });

    if (!subscription) {
      return createResponse(404, { error: 'No active subscription found' });
    }

    return createResponse(200, { cancelUrl: subscription.cancelUrl });
  } catch (error) {
    console.error('Error getting cancellation URL:', error);
    return createResponse(500, { error: 'Failed to get cancellation URL' });
  }
};

async function handleSubscriptionCancelled(data) {
  const { subscription_id, cancellation_effective_date } = data;

  const subscription = await Subscription.findOneAndUpdate(
    { paddleSubscriptionId: subscription_id },
    {
      status: 'cancelled',
      cancelledAt: new Date(),
      currentPeriodEnd: new Date(cancellation_effective_date)
    }
  );

  if (subscription) {
    await User.findByIdAndUpdate(subscription.userId, {
      subscriptionStatus: 'cancelled'
    });
  }
}

async function handlePaymentFailed(data) {
  const { subscription_id } = data;

  const subscription = await Subscription.findOneAndUpdate(
    { paddleSubscriptionId: subscription_id },
    { status: 'past_due' }
  );

  if (subscription) {
    await User.findByIdAndUpdate(subscription.userId, {
      subscriptionStatus: 'past_due'
    });
  }
}

