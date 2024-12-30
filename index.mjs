import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import UserRoutes from "./src/Users/routes/UserRoutes.mjs";
import ChatRoutes from "./src/Chat/routes/ChatRoutes.mjs";
import UsageRoutes from "./src/Usage/routes/usageRoutes.mjs";
import SubscriptionRoutes from "./src/Subscription/routes/subscriptionRoutes.mjs";
import cors from 'cors';
import session from "express-session";
import cookieParser from "cookie-parser";
import {v4 as uuidv4 } from "uuid"
import jwt from "jsonwebtoken"
import { CONSTANTS, COOKIE_CONFIG, getCookieConfig} from "./src/utils/constants.mjs"
import crypto from "crypto"

import pkg from 'passport';
const passport = pkg;



const app = express();
dotenv.config();



// CORS configuration 
const corsConfig = {
    origin: (origin, callback) => {
        const allowedOrigins = ['https://twineaihub.com'];
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, origin);
        } else {
            console.log('Blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Methods',
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Credentials',
        'Set-Cookie',
        'Cookie'
    ],
    exposedHeaders: ['Set-Cookie'],
    maxAge: 86400
};

app.use(cors(corsConfig));




// Database connection with retry logic
const connectDB = async (retries = 5) => {
    try {
        await mongoose.connect(process.env.MONGODB_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 30000,
            serverSelectionTimeoutMS: 30000,
        });
        console.log("Database connection successful");
    } catch (error) {
        if (retries > 0) {
            console.log(`Database connection failed. Retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return connectDB(retries - 1);
        }
        console.error("Database connection failed after all retries:", error);
        throw error; // Let the error be handled by global error handler
    }
};

// Middleware setup
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.JWT_SECRET));




// Session configuration with security options
app.use(session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        ...COOKIE_CONFIG,
        secure: true,
        sameSite:'none',
    }
}));

app.use(passport.initialize());

app.use(passport.session());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Origin:
     ${req.headers.origin || 'No origin'}`);
    next();
});

const generateAnonTokens = (req, res, next) => {
    const isAuthenticated = !!(req.cookies.idToken && req.cookies.authToken);
    
    if (!isAuthenticated) {
        try {
            const existingAnonToken = req.cookies.anonToken;
            const ipAddress = req.ip || req.connection.remoteAddress;
            const hash = crypto.createHash('sha256').update(ipAddress).digest('hex');
            
            if (existingAnonToken) {
                try {
                    const decoded = jwt.verify(existingAnonToken, process.env.JWT_SECRET);
                    if (decoded.anonymous) return next();
                } catch {
                    // Invalid token - will generate new one
                }
            }
            
            const anonymousId = `${uuidv4()}-${hash.substring(0, 8)}`;
            const anonToken = jwt.sign(
                {
                    _id: anonymousId,
                    anonymousId,
                    anonymous: true,
                    isAuthenticated: false,
                    role: 'anonymous',
                    version: 1,
                    ip: hash
                },
                process.env.JWT_SECRET,
                {
                    algorithm: CONSTANTS.TOKEN.ALGORITHM,
                    expiresIn: CONSTANTS.TOKEN.ANONYMOUS_MAX_AGE
                }
            );

            // Set cookies with appropriate settings for Function URL
            const cookieOptions = {
                ...getCookieConfig(),
                sameSite:  'none' ,
                secure: true
            };

            res.cookie('anonToken', anonToken, cookieOptions);
            res.cookie('anonymousId', anonymousId, cookieOptions);
        } catch (error) {
            console.error('Error generating anonymous token:', error);
        }
    }
    next();
}

app.get ('/', generateAnonTokens);

// Initialize DB connection
connectDB().catch(console.error);

// Routes
app.use(UserRoutes);
app.use(ChatRoutes);
app.use(UsageRoutes);
app.use(SubscriptionRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            error: 'CORS Error',
            message: `Origin '${req.headers.origin}' not allowed`
        });
    }
    
    res.status(err.status || 500).json({
        error: err.name || 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
            ? 'An unexpected error occurred' 
            : err.message
    });
});




export default app;
// app.listen(4000, () => {
//     console.log(`Server is running on port ${4000}`);
// });