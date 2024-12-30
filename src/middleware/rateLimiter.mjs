import { UserModel, UserRequest } from "../Users/schema/Users.mjs";
import crypto from "crypto"
import jwt from "jsonwebtoken"
import dotenv from "dotenv"


dotenv.config();
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
  

const RATE_LIMITS = {
    ANONYMOUS: 10,
    REGISTERED: 20,
    SUBSCRIBED: Infinity
};


export const rateLimiter = async (req, res, next) => {
    try {
        const isGetRequest = req.method === 'GET';
        const userIdFromCookie = req.cookies.idToken;
        const authToken = req.cookies.authToken;
        const anonymousId = req.cookies[CONSTANTS.COOKIES.ANONYMOUS];
        const rawIp = req.ip || req.connection.remoteAddress;

        // Hash IP address for anonymous users
        const clientIpHash = crypto.createHash('sha256').update(rawIp).digest('hex');
        const clientIp = `ip_${clientIpHash}`;

        // Adjusted authentication check
        const isAuthenticated = (req.user && !req.user.anonymous) || (userIdFromCookie && authToken);

        let userLimit;
        let responseMessage;

        // Decode idToken to extract user ID
        let userId = null;
        if (userIdFromCookie) {
            try {
                const decoded = jwt.verify(userIdFromCookie, process.env.JWT_SECRET); // Ensure your JWT_SECRET matches the one used to sign the tokens
                userId = decoded.userId; // Assumes the JWT payload has a `userId` field
            } catch (err) {
                console.error('Failed to decode JWT:', err);
                res.clearCookie('idToken');
                res.clearCookie('authToken');
                return res.status(401).json({ message: "Invalid or expired token. Please login again." });
            }
        }

        // Handle GET requests that don't require authentication
        if (isGetRequest && !isAuthenticated) {
            userLimit = RATE_LIMITS.ANONYMOUS;
            responseMessage = "Request limit reached. Please register to get more access.";
            return await handleAnonymousRequest(clientIp, userLimit, responseMessage, req, res, next);
        }

        // Proceed with authenticated handling
        if (isAuthenticated) {
            let user;

            // Fetch user by req.user._id or decoded userId
            if (req.user && req.user._id) {
                user = await UserModel.findById(req.user._id);
            } else if (userId) {
                user = await UserModel.findById(userId);
            }

            if (!user) {
                res.clearCookie('idToken');
                res.clearCookie('authToken');
                return res.status(401).json({ message: "Invalid user credentials. Please login again." });
            }

            // Set appropriate limits based on subscription status
            if (!user.isSubscribed) {
                userLimit = RATE_LIMITS.REGISTERED;
                responseMessage = "Daily request limit reached. Please subscribe to get more access.";
            } else {
                userLimit = RATE_LIMITS.SUBSCRIBED;
                responseMessage = "Request limit reached.";
            }

            // Check if there's an existing anonymous record to migrate
            if (anonymousId) {
                await migrateAnonymousRequests(clientIp, user._id);
                res.clearCookie(CONSTANTS.COOKIES.ANONYMOUS);
                res.clearCookie(CONSTANTS.COOKIES.ANONAUTH);
            }

            return await handleAuthenticatedRequest(user._id, userLimit, responseMessage, req, res, next);
        }

        // Handle anonymous requests for non-GET methods if unauthenticated
        userLimit = RATE_LIMITS.ANONYMOUS;
        responseMessage = "Request limit reached. Please register to get more access.";
        return await handleAnonymousRequest(clientIp, userLimit, responseMessage, req, res, next);

    } catch (error) {
        console.error('Rate limiter error:', error);
        next(error);
    }
};


async function migrateAnonymousRequests(clientIp, userId) {
    try {
        // Find anonymous requests for this IP
        const anonymousRequest = await UserRequest.findOne({
            userId: clientIp,
            isAuthenticated: false
        });

        if (anonymousRequest) {
            // Find or create authenticated request record
            let authenticatedRequest = await UserRequest.findOne({
                userId: userId,
                isAuthenticated: true
            });

            if (authenticatedRequest) {
                // If authenticated record exists, reset it instead of adding anonymous counts
                authenticatedRequest.requestCount = 0;
                authenticatedRequest.lastRequest = Date.now();
                await authenticatedRequest.save();
            } else {
                // Create new authenticated record with fresh count
                authenticatedRequest = await UserRequest.create({
                    userId: userId,
                    isAuthenticated: true,
                    requestCount: 0,
                    lastRequest: Date.now()
                });
            }

            // Delete the anonymous record
            await UserRequest.deleteOne({
                userId: clientIp,
                isAuthenticated: false
            });
        }
    } catch (error) {
        console.error('Error migrating anonymous requests:', error);
        // Don't throw error to prevent blocking the request
    }
}

async function handleAuthenticatedRequest(userId, userLimit, responseMessage, req, res, next) {
    const currentTime = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    let userRequest = await UserRequest.findOne({
        userId: userId,
        isAuthenticated: true
    });

    if (!userRequest) {
        await UserRequest.create({
            userId: userId,
            isAuthenticated: true,
            requestCount: 1,
            lastRequest: currentTime
        });
        return next();
    }

    if (currentTime - userRequest.lastRequest > oneDay) {
        userRequest.requestCount = 1;
        userRequest.lastRequest = currentTime;
        await userRequest.save();
        return next();
    }

    if (userRequest.requestCount >= userLimit) {
        return res.status(409).json({
            message: responseMessage,
            currentCount: userRequest.requestCount,
            limit: userLimit,
            remainingTime: new Date(userRequest.lastRequest + oneDay).toISOString()
        });
    }

    userRequest.requestCount += 1;
    userRequest.lastRequest = currentTime;
    await userRequest.save();

    return next();
}

async function handleAnonymousRequest(clientIp, userLimit, responseMessage, req, res, next) {
    const currentTime = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    let userRequest = await UserRequest.findOne({
        userId: clientIp,
        isAuthenticated: false
    });

    if (!userRequest) {
        await UserRequest.create({
            userId: clientIp,
            isAuthenticated: false,
            requestCount: 1,
            lastRequest: currentTime
        });
        return next();
    }

    if (currentTime - userRequest.lastRequest > oneDay) {
        userRequest.requestCount = 1;
        userRequest.lastRequest = currentTime;
        await userRequest.save();
        return next();
    }

    if (userRequest.requestCount >= userLimit) {
        return res.status(409).json({
            message: responseMessage,
            currentCount: userRequest.requestCount,
            limit: userLimit,
            remainingTime: new Date(userRequest.lastRequest + oneDay).toISOString()
        });
    }

    userRequest.requestCount += 1;
    userRequest.lastRequest = currentTime;
    await userRequest.save();

    return next();
}


