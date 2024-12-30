import { Router } from "express";
import { Login } from "../controllers/login.mjs";
import { UserSignUp } from "../controllers/signup.mjs";
import { GetUserProfile } from "../controllers/profile.mjs";
import jwt from 'jsonwebtoken'
import { verifyToken } from "../auth.mjs";
import { checkAuth } from "../controllers/checkAuth.mjs"
import { userLogout } from "../controllers/logout.mjs";
import { tokenRefresh } from "../controllers/tokenRefresh.mjs";
import { googleSignIn } from "../controllers/googleController.mjs"
import pkg from 'passport';


const passport = pkg;


const router = Router();
passport.initialize()


export const authCorsMiddleware = (req, res, next) => {
    const allowedOrigins = [
        'https://twineaihub.com',
        'https://dev.twineaihub.com',
        'https://thirdman-frontend.vercel.app',
       
    ];
    
    const origin = req.headers.origin;
    
    // Set CORS headers for all requests, not just allowed origins
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 
        'Content-Type, Authorization, X-Requested-With, Accept, Origin, Set-Cookie, Cookie'
    );
    
    // Set origin header if it's an allowed origin
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    // Respond to preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
};






// Apply the middleware before the route
router.use('/auth/status', authCorsMiddleware);


 
router.post('/api/auth/login', Login);

router.post('/api/auth/signup', UserSignUp);

router.get('/api/user/profile', verifyToken, GetUserProfile);

// Google OAuth Login/Sign-in route
router.post('/auth/google', googleSignIn);

// Route to handle the callback from Cognito after Google login
// router.get('/auth/google/callback', handleGoogleCallback);

router.get('/auth/logout', userLogout);

router.get('/auth/status', checkAuth);


router.post('/auth/refresh-token', tokenRefresh);


export default router;
