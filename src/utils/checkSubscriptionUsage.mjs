import { UserModel } from "../Users/schema/Users.mjs";
import { Subscription } from "../Subscription/schema/subscription.mjs";
import { UserBillingModel } from "../Usage/schema/tokenSchema.mjs";


// Middleware to check if user is within their subscription usage cap
export const checkSubscriptionUsage = async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(404).send("User Not Found");
  
      // Fetch subscription information and check the type
      const subscription = await Subscription.findOne({ userId: user._id });
      if (!subscription) return res.status(404).send("No subscription data found for this user");
  
      const usageLimit = subscription.planId === 'weekly_basic' ? 3 : 12; // Adjust based on subscription type
      const isPremium = subscription.planId === 'monthly_premium'; 
  
      // Skip checks if the user has a premium subscription
      if (isPremium) return next();
  
      // Check if monthly usage is within the usage cap
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const userBilling = await UserBillingModel.findOne({
        user: user._id,
        "tokenUsage.date": { $gte: firstDayOfMonth, $lte: now }
      });
  
      const totalCost = userBilling?.tokenUsage.reduce((sum, entry) => sum + entry.cost, 0) || 0;
  
      // Check if usage is within the limit
      if (totalCost >= usageLimit) {
        return res.status(403).send("Usage limit reached. Please top up credits.");
      }
  
      next();
    } catch (error) {
      console.error(error);
      res.status(500).send("Server error");
    }
  };
  

// Middleware to enforce usage limits, prioritizing subscription cap, then carried-forward, then purchased credits
export const enforceUsageLimits = async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(404).send("User not found");
  
      const userBilling = await UserBillingModel.findOne({ user: user._id });
      if (!userBilling) return res.status(404).send("Billing data not found");
  
      const now = new Date();
      const usageLimit = userBilling.subscriptionType === 'weekly' ? 3 : 12;
      const totalUsage = userBilling.monthlyUsage;
  
      if (totalUsage < usageLimit) {
        // Within subscription cap, allow usage
        next();
      } else if (userBilling.carriedForwardCredit > 0) {
        // If subscription cap exceeded, use carried-forward credits
        userBilling.carriedForwardCredit -= totalUsage - usageLimit;
        await userBilling.save();
        next();
      } else if (userBilling.creditBalance > 0) {
        // If no carried-forward credits, use purchased credits
        userBilling.creditBalance -= totalUsage - usageLimit;
        await userBilling.save();
        next();
      } else {
        // No credits remaining
        return res.status(403).send("Subscription cap reached. Please purchase additional credits.");
      }
    } catch (error) {
      console.error(error);
      res.status(500).send("Server error");
    }
};

