import { Subscription } from '../schema/subscription.mjs';
import { UserModel } from "../../Users/schema/Users.mjs"
import { createHmac } from 'crypto';
import jwt from "jsonwebtoken"
import dotenv from "dotenv"

dotenv.config()

export class SubscriptionController {
  // Keep webhook signature verification
  static verifyWebhookSignature(rawBody, signature) {
    const hmac = createHmac('sha256', process.env.PADDLE_PUBLIC_KEY)
      .update(rawBody)
      .digest('hex');
    return hmac === signature;
  }

  // Simplified webhook handler
  static async handleWebhook(req, res) {
    try {
      const signature = req.headers['paddle-signature'];
      if (!SubscriptionController.verifyWebhookSignature(req.rawBody, signature)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      const { alert_name, ...data } = req.body;

      switch (alert_name) {
        case 'subscription_created':
        case 'subscription_updated':
          await SubscriptionController.syncSubscriptionStatus(data);
          break;
        case 'subscription_cancelled':
          await SubscriptionController.handleSubscriptionCancelled(data);
          break;
        case 'subscription_payment_failed':
          await SubscriptionController.handlePaymentFailed(data);
          break;
      }

      res.status(200).send('Webhook processed');
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  // Simplified status sync
  static async syncSubscriptionStatus(data) {
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

    await UserModel.findByIdAndUpdate(user_id, {
      subscriptionStatus: status || 'active',
      currentSubscription: subscription._id
    });
  }

  static async handleSubscriptionCancelled(data) {
    const { subscription_id, cancellation_effective_date } = data;

    await Subscription.findOneAndUpdate(
      { paddleSubscriptionId: subscription_id },
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        currentPeriodEnd: new Date(cancellation_effective_date)
      }
    );

    const subscription = await Subscription.findOne({ paddleSubscriptionId: subscription_id });
    if (subscription) {
      await UserModel.findByIdAndUpdate(subscription.userId, {
        subscriptionStatus: 'cancelled'
      });
    }
  }

  static async handlePaymentFailed(data) {
    const { subscription_id } = data;

    const subscription = await Subscription.findOneAndUpdate(
      { paddleSubscriptionId: subscription_id },
      { status: 'past_due' }
    );

    if (subscription) {
      await UserModel.findByIdAndUpdate(subscription.userId, {
        subscriptionStatus: 'past_due'
      });
    }
  }

  // User-facing endpoints
  static async getSubscriptionDetails(req, res) {
    const token = req.cookies.authToken
    const user= jwt.verify(token, process.env.JWT_SECRET)
    const userId = user.userId

    try {
      const subscription = await Subscription.findOne({
        userId: userId
      }).sort({ createdAt: -1 });

      if (!subscription) {
        return res.status(404).json({ error: 'No subscription found' });
      }

      res.json(subscription);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch subscription details' });
    }
  }

  // Redirect to Paddle's hosted pages for management
  static async cancelSubscription(req, res) {
    const token = req.cookies.authToken
    const user= jwt.verify(token, process.env.JWT_SECRET)
    const userId = user.userId
    try {
      const subscription = await Subscription.findOne({
        userId: userId,
        status: 'active'
      });

      if (!subscription) {
        return res.status(404).json({ error: 'No active subscription found' });
      }

      res.json({ cancelUrl: subscription.cancelUrl });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get cancellation URL' });
    }
  }
}
