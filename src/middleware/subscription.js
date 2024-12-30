import jwt from "jsonwebtoken"
import dotenv from "dotenv"

dotenv.config()



export const checkSubscriptionStatus = async (req, res, next) => {
    try {
      const token = req.cookies.authToken;
      const decodedUser = jwt.verify(token, process.env.JWT_SECRET)
      const userId = decodedUser.userId
      const subscription = await Subscription.findOne({
        userId: userId,
        status: 'active'
      });
  
      if (!subscription) {
        return res.status(403).json({ error: 'Active subscription required' });
      }
  
      // Check if subscription is expired
      if (new Date() > subscription.currentPeriodEnd) {
        subscription.status = 'expired';
        await subscription.save();
        return res.status(403).json({ error: 'Subscription expired' });
      }
  
      req.subscription = subscription;
      next();
    } catch (error) {
      res.status(500).json({ error: 'Failed to check subscription status' });
    }
  };