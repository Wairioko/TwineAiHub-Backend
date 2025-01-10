import jwt from "jsonwebtoken"
import { UserModel } from "../Users/schema/Users.mjs";
import { UserBillingModel } from "../Usage/schema/tokenSchema.mjs";
import { Subscription } from "../Subscription/schema/subscription.mjs";



export const tokenLimitSubChecker = async (req, res, next) => {
    try {
        const userIdFromCookie = req.cookies.idToken;

        // Decode idToken to extract user ID
        let userId = null;
        if (userIdFromCookie) {
            try {
                const decoded = jwt.verify(userIdFromCookie, process.env.JWT_SECRET);
                userId = decoded.userId;
            } catch (err) {
                res.clearCookie("idToken");
                res.clearCookie("authToken");
                return res.status(401).json({ message: "Invalid or expired token. Please login again." });
            }
        }

        if (!userId) {
            return res.status(401).json({ message: "User not authenticated." });
        }

        // Fetch user data
        const user = await UserModel.findById(userId);
        if (!user || !user.subscriptionStatus) {
            return res.status(403).json({ message: "No active subscription found. Please subscribe to continue." });
        }

        // Fetch token usage
        const userTokens = await UserBillingModel.findById(userId);
        if (!userTokens) {
            return res.status(404).json({ message: "User token details not found." });
        }

        const tokensUsed = userTokens.tokenUsage.totalTokens;

        // Fetch subscription details
        const subscription = await Subscription.findOne({ userId });
        if (!subscription) {
            return res.status(404).json({ message: "Subscription details not found." });
        }

        const subscriptionPlan = subscription.items?.prices?.description;
        const tokenLimits = {
            "Weekly": 700000,
            "Monthly Standard": 3000000,
            "Monthly Premium": 10000000,
        };

        if (tokensUsed <= (tokenLimits[subscriptionPlan] || 0)) {
            return next();
        } else {
            return res.status(400).json({ message: "Please purchase additional credits to proceed." });
        }
    } catch (err) {
        console.error("Error in token limit checker middleware:", err);
        return res.status(500).json({ message: "An internal server error occurred." });
    }
};

