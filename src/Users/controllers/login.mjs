import { UserModel } from "../schema/Users.mjs";
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getCookieConfig, getRefreshCookieConfig } from "../../utils/constants.mjs";
import { 
    CognitoIdentityProviderClient, 
    InitiateAuthCommand,
    NotAuthorizedException,
    UserNotFoundException
} from '@aws-sdk/client-cognito-identity-provider';

dotenv.config();

// Initialize Cognito Client
const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.COGNITO_AWS_REGION
});



export const Login = async (req, res) => {
    const { email, password } = req.body;

    // Input validation
    if (!email) return res.status(400).json({ message: "Email is required." });
    if (!password) return res.status(400).json({ message: "Password is required." });

    try {
        // Authenticate with Cognito
        const authCommand = new InitiateAuthCommand({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: process.env.COGNITO_CLIENT_ID,
            AuthParameters: {
                USERNAME: email.toLowerCase(),
                PASSWORD: password
            }
        });

        const response = await cognitoClient.send(authCommand);
        const { AccessToken, IdToken, RefreshToken } = response.AuthenticationResult;

        // Find user in MongoDB
        const user = await UserModel.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
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

            // Set cookies for tokens
            res.cookie('authToken', authToken, getCookieConfig());
            res.cookie('idToken', idToken, getCookieConfig());
            res.cookie('refreshToken', refreshToken, getRefreshCookieConfig());
        // Clear any existing anonymous ID if present
        if (req.cookies.anonymousId) {
            res.clearCookie('anonymousId', getCookieConfig());
        }

        // Prepare user data to return
        const userData = {
            _id: user._id,
            email: user.email,
            username: user.username
        };

        return res.status(200).json({
            message: "Login successful",
            user: userData
        });

    } catch (error) {
        console.error('Login error:', error);

        // Handle specific Cognito errors
        if (error.name === 'NotAuthorizedException') {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        if (error.name === 'UserNotFoundException') {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(500).json({
            message: "Error logging in",
            error: error.message
        });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    try {
        // Authenticate with Cognito
        const authCommand = new InitiateAuthCommand({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: process.env.COGNITO_CLIENT_ID,
            AuthParameters: {
                USERNAME: email.toLowerCase(),
                PASSWORD: password,
            },
        });
        const response = await cognitoClient.send(authCommand);
        const { AccessToken, IdToken, RefreshToken } = response.AuthenticationResult;

        // Find the user in MongoDB
        const user = await UserModel.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        // Generate authToken using MongoDB user ID
        const authToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Token valid for 1 hour
        );

        const cookieOptions = {
            ...getCookieConfig(),
            sameSite: 'none' ,
            secure: true
        };

   
        res.cookie('authToken', authToken, cookieOptions);
        res.cookie('userid', IdToken, cookieOptions);
        res.cookie('refreshToken', RefreshToken, getRefreshCookieConfig());

        // Respond with user data
        return res.status(200).json({
            message: "Login successful.",
            
        });
    } catch (error) {
        console.error('Login error:', error);
        if (error.name === 'NotAuthorizedException') {
            return res.status(401).json({ message: "Invalid email or password." });
        }
        return res.status(500).json({ message: "Login failed.", error: error.message });
    }
};


