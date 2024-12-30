import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pkg from 'passport';
const passport = pkg;
import dotenv from 'dotenv'

dotenv.config();

// Constants
const CONSTANTS = {
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


// Public paths that don't require authentication
const PUBLIC_PATHS = new Set([
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


// Cookie configuration with enhanced security options
const getCookieConfig = () => ({
  maxAge: CONSTANTS.COOKIE_MAX_AGE,
  httpOnly: true,
  secure: true,
  sameSite: 'None', 
  path: '/',
  signed: true, 
  domain: process.env.COOKIE_DOMAIN
});


// JWT verification with detailed error handling
const verifyJWT = (token, secret) => {
  if (!token || !secret) {
    throw new Error('Missing required parameters for JWT verification');
  }

  try {
    return jwt.verify(token, secret, {
      algorithms: [CONSTANTS.TOKEN.ALGORITHM],
      maxAge: CONSTANTS.TOKEN.MAX_AGE
    });
  } catch (error) {
    const isExpired = error.name === 'TokenExpiredError';
    throw {
      status: isExpired ? CONSTANTS.HTTP_STATUS.UNAUTHORIZED : CONSTANTS.HTTP_STATUS.FORBIDDEN,
      message: isExpired ? 'Token has expired' : 'Invalid token',
      originalError: error
    };
  }
};


// Path matcher utility for public routes
const isPublicPath = (path) => {
  return Array.from(PUBLIC_PATHS).some(pattern => {
    const regexPattern = pattern
      .replace(/:\w+/g, '[^/]+') 
      .replace(/\//g, '\\/');    
    return new RegExp(`^${regexPattern}$`).test(path);
  });
};


const handleAnonymousUser = (req, res) => {
  // Generate or retrieve anonymous ID
  const anonymousId = req.cookies[CONSTANTS.COOKIES.ANONYMOUS] || uuidv4();
  
  // Create token payload
  const tokenPayload = {
    _id: anonymousId,
    anonymousId,
    anonymous: true,
    role: 'anonymous',
    version: 1
  };

  // Generate JWT token
  const anonToken = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET,
    {
      algorithm: CONSTANTS.TOKEN.ALGORITHM,
      expiresIn: CONSTANTS.TOKEN.ANONYMOUS_MAX_AGE
    }
  );

  // Use consistent cookie settings
  const cookieOptions = {
    maxAge: CONSTANTS.COOKIE_MAX_AGE,
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/'
  };

  // Set both the anonymous ID and token cookies
  res.cookie(CONSTANTS.COOKIES.ANONYMOUS, anonymousId, cookieOptions);
  res.cookie(CONSTANTS.COOKIES.ANONAUTH, anonToken, cookieOptions);

  return {
    anonToken,
    ...tokenPayload
  };
};

// Main authentication middleware with anonymous user support
export const verifyToken = (req, res, next) => {
  // First check if it's a public path
  if (isPublicPath(req.path)) {
    // For public paths, still try to attach user info if available
    const token = req.cookies[CONSTANTS.COOKIES.AUTH];
    if (token) {
      try {
        const decoded = verifyJWT(token, process.env.JWT_SECRET);
        req.user = decoded;
        
      } catch (error) {
        
        req.user = handleAnonymousUser(req, res);
      }
    } else if (process.env.ALLOW_ANONYMOUS === 'true') {
      
      req.user = handleAnonymousUser(req, res);
    }
    
    return next();
  }

  // Non-public path handling
  try {
    const token = req.cookies[CONSTANTS.COOKIES.AUTH];
    
    if (!token) {
      if (process.env.ALLOW_ANONYMOUS === 'true') {
        
        req.user = handleAnonymousUser(req, res);
        return next();
      }
      throw {
        status: CONSTANTS.HTTP_STATUS.UNAUTHORIZED,
        message: 'Authentication required'
      };
    }

    const decoded = verifyJWT(token, process.env.JWT_SECRET);
    
    // Verify anonymous user consistency
    if (decoded.anonymous) {
      const anonymousId = req.cookies[CONSTANTS.COOKIES.ANONYMOUS];
      if (!anonymousId || decoded.anonymousId !== anonymousId) {
        req.user = handleAnonymousUser(req, res);
        return next();
      }
    }

    req.user = decoded;
    next();
    
  } catch (error) {
    console.error('Auth error:', error);
    
    // Handle token errors by creating a new anonymous user
    if (process.env.ALLOW_ANONYMOUS === 'true') {
      
      req.user = handleAnonymousUser(req, res);
      return next();
    }
    
    return res.status(error.status || CONSTANTS.HTTP_STATUS.UNAUTHORIZED)
      .json({ 
        message: error.message || 'Authentication failed',
        code: error.code || 'AUTH_ERROR'
      });
  }
};


// Enhanced token management functions
export const setAuthToken = (res, token, options = {}) => {
  if (!token) {
    throw new Error('Token is required');
  }
  
  const cookieConfig = {
    ...getCookieConfig(),
    ...options
  };
  
  res.cookie(CONSTANTS.COOKIES.AUTH, token, cookieConfig);
};


export const clearAuthToken = (res) => {
  res.clearCookie(CONSTANTS.COOKIES.AUTH, {
    ...getCookieConfig(),
    maxAge: 0
  });
};


// Middleware to refresh token if close to expiration
export const refreshTokenIfNeeded = (req, res, next) => {
  if (!req.user || !req.user.tokenExpires) {
    return next();
  }

  const expiresIn = new Date(req.user.tokenExpires) - new Date();
  const refreshThreshold = 24 * 60 * 60 * 1000; 

  if (expiresIn < refreshThreshold) {
    const newToken = jwt.sign(
      { userId: req.user._id},
      process.env.JWT_SECRET,
      { algorithm: CONSTANTS.TOKEN.ALGORITHM, expiresIn: CONSTANTS.TOKEN.MAX_AGE }
    );
    setAuthToken(res, newToken);
  }

  next();
};


// Set up passport serialization
passport.serializeUser((user, done) => {
  done(null, user.userId);
});

passport.deserializeUser(async (id, done) => {
  try {
      const user = await UserModel.findById(id);
      done(null, user);
  } catch (err) {
      done(err, null);
  }
});



export default passport;