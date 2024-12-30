import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

let isConnected = false;

const BASE_CONSTANTS = {
  COOKIES: {
    AUTH: 'authToken',
    ANONYMOUS: 'anonymousId',
    ANONAUTH: 'anonToken',
  },
  TOKEN: {
    PREFIX: 'Bearer',
    ALGORITHM: 'HS256',
    MAX_AGE: '1d',
    ANONYMOUS_MAX_AGE: '30d'
  },
  COOKIE_MAX_AGE: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
  HTTP_STATUS: {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403
  }
};

// File constants
export const FILE_CONSTANTS = {
  ALLOWED_TYPES: [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ],
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  UPLOAD_PATH: 'uploads',
  DAILY_REQUEST_LIMIT: 100
};


// Database connection
export const connectToDatabase = async () => {
  if (!mongoose.isConnected) {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    mongoose.isConnected = true;
  }
};


// Cookie configuration function
export const getCookieConfig = () => ({
  maxAge: BASE_CONSTANTS.COOKIE_MAX_AGE,
  httpOnly: true,
  secure: true,
  sameSite: 'None',
  path: '/',
  // domain: process.env.COOKIE_DOMAIN  
});

export const getRefreshCookieConfig = () => ({
  maxAge: 24 * 60 * 60 * 7,
  httpOnly: true,
  secure: true,
  sameSite: 'None',
  path: '/',
  domain: process.env.COOKIE_DOMAIN   
});

// Export cookie config using the function
export const COOKIE_CONFIG = getCookieConfig();

// Export cookie options (if you need a separate constant)
export const cookieOptions = getCookieConfig();

// Public paths
export const PUBLIC_PATHS = new Set([
  '',
  '/api/auth/login/',
  '/api/auth/signup',
  '/api/assistant/analyze',
  '/api/chat/solve',
  '/api/chat/feedback',
  '/api/chat/:chatid/:name',
  '/api/chat/edit',
  '/api/chat/feedback',
  '/api/chat/:chatId'
]);

// Export main constants

export const CONSTANTS = BASE_CONSTANTS;
