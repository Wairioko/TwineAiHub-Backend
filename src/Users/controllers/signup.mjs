// signupController.mjs
import { UserModel } from "../schema/Users.mjs";
import { UserBillingModel } from "../../Usage/schema/tokenSchema.mjs";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getCookieConfig, getRefreshCookieConfig} from "../../utils/constants.mjs";
import { AdminCreateUserCommand, AdminSetUserPasswordCommand, 
    CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";



dotenv.config();

// Initialize Cognito Client
const cognitoClient = new CognitoIdentityProviderClient({
    region: process.env.COGNITO_AWS_REGION
});


export const UserSignUp = async (req, res) => {
    const { username, email, password } = req.body;

    console.log("Received Payload:", req.body);


    // Input validation
    if (!username?.trim()) return res.status(400).json({ message: "Username is required" });
    if (!email?.trim()) return res.status(400).json({ message: "Email is required" });
    if (!password?.trim()) return res.status(400).json({ message: "Password is required" });

    // Password strength validation
    if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }

    try {

        

        // Register user in Cognito
        const createUserCommand = new AdminCreateUserCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID,
            Username: email.toLowerCase(),
            UserAttributes: [
                { Name: 'email', Value: email.toLowerCase() },
                { Name: 'preferred_username', Value: username.toLowerCase() }
            ],
            TemporaryPassword: password,
            MessageAction: 'SUPPRESS' // Suppress email invitation
        });

        const cognitoUser = await cognitoClient.send(createUserCommand);

        // Set permanent password
        const setPasswordCommand = new AdminSetUserPasswordCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID,
            Username: email.toLowerCase(),
            Password: password,
            Permanent: true
        });

        await cognitoClient.send(setPasswordCommand);

        // Hash password for MongoDB
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user in MongoDB
        const user = new UserModel({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password: hashedPassword,
            cognitoSub: cognitoUser.User.Username, // Store Cognito Sub
            createdAt: new Date(),
            lastLogin: new Date()
        });

        const savedUser = await user.save();

        // Create billing record
        const newUserBilling = new UserBillingModel({
            user: savedUser._id,  
            anonymousUser: "N/A", 
            subscriptionType: "Free",
            tokenUsage: [],
            creditBalance: 0,
            carriedForwardCredit: 0,
            monthlyUsage: 0
        });

        await newUserBilling.save();

        // Authenticate to get tokens
        const authCommand = new InitiateAuthCommand({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: process.env.COGNITO_CLIENT_ID,
            AuthParameters: {
                USERNAME: email.toLowerCase(),
                PASSWORD: password
            }
        });

        const authResult = await cognitoClient.send(authCommand);
        const { AccessToken, IdToken, RefreshToken } = authResult.AuthenticationResult;

         // Generate authToken using MongoDB user ID
         const authToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Token valid for 1 hour
        );

   
        res.cookie('authToken', authToken, getCookieConfig());
        res.cookie('idToken', IdToken, getCookieConfig());
        res.cookie('refreshToken', RefreshToken, getRefreshCookieConfig());

        // Clear any existing anonymous ID
        if (req.cookies.anonymousId) {
            res.clearCookie('anonymousId', getCookieConfig());
        }

        // Return user data
        const userData = {
            _id: savedUser._id,
            username: savedUser.username,
            email: savedUser.email
        };

        return res.status(201).json({
            message: "User created successfully",
            user: userData
        });

    } catch (error) {
        console.error("Signup error:", error);
        if (error.code === 11000) {
            return res.status(400).json({ message: "Email already in use." });
        }
        

        // Handle specific Cognito errors
        if (error.name === 'UsernameExistsException') {
            return res.status(400).json({ message: "User already exists in Cognito" });
        }

        return res.status(500).json({
            message: "An error occurred while creating your account",
            error: error.message
        });
    }
};

