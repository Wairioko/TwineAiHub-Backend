import { UserModel } from '../../Users/schema/Users.mjs';
import { UserBillingModel } from '../../Usage/schema/tokenSchema.mjs';
import { getCookieConfig, getRefreshCookieConfig } from '../../utils/constants.mjs';
import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';


dotenv.config()


const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);



export const googleSignIn = async (req, res) => {
  const { tokenId } = req.body;

  if (!tokenId) {
      return res.status(400).json({ message: "Google token is required." });
  }

  try {
      // Verify Google token
      const ticket = await googleClient.verifyIdToken({
          idToken: tokenId,
          audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      if (!payload) {
          return res.status(401).json({ message: "Invalid Google token." });
      }

      const { email, sub: googleId, name: username } = payload;

      // Check if user already exists in MongoDB
      let user = await UserModel.findOne({ email: email.toLowerCase() });

      if (!user) {
          // Create new user record
          user = new UserModel({
              username: username.toLowerCase(),
              email: email.toLowerCase(),
              googleId: googleId,
              provider: "google",
              createdAt: new Date(),
              lastLogin: new Date(),
          });
          await user.save();

          // Create billing record for new user
          const billingRecord = new UserBillingModel({
              userId: user._id,
              tokenUsage: [],
              subscriptionType: "none",
              createdAt: new Date(),
          });
          await billingRecord.save();
      } else {
          // Update last login time
          user.lastLogin = new Date();
          await user.save();
      }

      // Generate authToken using MongoDB user ID
      const authToken = jwt.sign(
          { userId: user._id },
          process.env.JWT_SECRET,
          { expiresIn: '1h' } // Token valid for 1 hour
      );

      // 
      const idToken = jwt.sign(
          { userId: user._id },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
      );

      const refreshToken = jwt.sign(
          { userId: user._id },
          process.env.JWT_SECRET,
          { expiresIn: '7d' } // Refresh token valid for 7 days
      );
   
      const cookieOptions = {
        ...getCookieConfig(),
        sameSite: 'none' ,
        secure: true
    };
      // Set cookies for tokens
      res.cookie('authToken', authToken, cookieOptions);
      res.cookie('idToken', idToken, cookieOptions);
      res.cookie('refreshToken', refreshToken, cookieOptions);
     
      // Respond with user data
      return res.status(200).json({
          message: "Google sign-in successful.",
          user: { id: user._id, username: user.username, email: user.email },
      });
  } catch (error) {
      console.error("Google sign-in error:", error);
      return res.status(500).json({ message: "An error occurred during Google sign-in.", error: error.message });
  }
};


