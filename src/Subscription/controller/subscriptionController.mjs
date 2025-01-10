import { Subscription } from '../schema/subscription.mjs';
import { UserModel } from "../../Users/schema/Users.mjs"
import { createHmac } from 'crypto';
import jwt from "jsonwebtoken"
import dotenv from "dotenv"

dotenv.config()

// Verify Paddle webhook signature
const verifyPaddleWebhook = (req) => {
  const rawBody = req.rawBody;
  const signature = req.headers["paddle-signature"];
  const hmac = createHmac("sha256", process.env.PADDLE_PUBLIC_KEY);
  hmac.update(rawBody);
  const hash = hmac.digest("hex");
  return hash === signature;
};

// Handle client-side subscription confirmation
export const confirmSubscription = async (req, res) => {
  const token = req.cookies.authToken
  const user= jwt.verify(token, process.env.JWT_SECRET)
  const userId = user.userId
  try {
    // Extract transaction details from the request body
    const {
      id,
      status,
      customer_id,
      address_id,
      subscription_id,
      invoice_id,
      invoice_number,
      billing_details,
      currency_code,
      billing_period,
      created_at,
      updated_at,
      items,
    } = req.body;


    // Create a new subscription record
    const subscription = new Subscription({
      userId,
      id,
      status,
      customer_id,
      address_id,
      subscription_id,
      invoice_id,
      invoice_number,
      billing_details,
      currency_code,
      billing_period,
      created_at,
      updated_at,
      items,
      
    });

    const savedSubscription = await subscription.save();

    // Update the user's subscription status
    await UserModel.findByIdAndUpdate(userId, {
      currentSubscription: savedSubscription._id,
      subscriptionStatus: true,
    });

    res.status(200).json({ message: "Subscription confirmed successfully!" });
  } catch (error) {
    console.error("Error confirming subscription:", error);
    res.status(500).json({ error: "Failed to confirm subscription." });
  }
};

// Handle Paddle webhook
export const handlePaddleWebhook = async (req, res) => {
  try {
    if (!verifyPaddleWebhook(req)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const eventType = req.body.alert_name;
    const data = req.body;

    switch (eventType) {
      case "subscription_created":
        await handleSubscriptionCreated(data);
        break;
      case "subscription_updated":
        await handleSubscriptionUpdated(data);
        break;
      case "subscription_cancelled":
        await handleSubscriptionCancelled(data);
        break;
      default:
        console.warn(`Unhandled event type: ${eventType}`);
    }

    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
};

// Subscription-created handler
const handleSubscriptionCreated = async (data) => {
  const subscription = await Subscription.findOneAndUpdate(
    { subscriptionId: data.subscription_id },
    {
      status: "active",
      nextBillDate: new Date(data.next_bill_date),
      updatedAt: new Date(),
    },
    { upsert: true, new: true } // Create if doesn't exist
  );

  if (subscription) {
    await User.findOneAndUpdate(
      { currentSubscription: subscription._id },
      { subscriptionStatus: "true" }
    );
  }
};

// Subscription-updated handler
const handleSubscriptionUpdated = async (data) => {
  await Subscription.findOneAndUpdate(
    { subscriptionId: data.subscription_id },
    {
      status: data.status,
      nextBillDate: new Date(data.next_bill_date),
      updatedAt: new Date(),
    }
  );
};

// Subscription-cancelled handler
const handleSubscriptionCancelled = async (data) => {
  const subscription = await Subscription.findOneAndUpdate(
    { subscriptionId: data.subscription_id },
    {
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    }
  );

  if (subscription) {
    await UserModel.findOneAndUpdate(
      { currentSubscription: subscription._id },
      { subscriptionStatus: false }
    );
  }
};


