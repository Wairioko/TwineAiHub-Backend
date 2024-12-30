import serverless from 'serverless-http';
import app from "../index.mjs"


// Middleware to handle API Gateway events
const customMiddleware = (req, res, next) => {
  if (req.method === 'OPTIONS') {
      // Let the CORS middleware handle OPTIONS requests
      return next();
  }
  next();
};

app.use(customMiddleware);

// Configure cookie settings for Lambda environment
const cookieSettings = {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
    domain: process.env.COOKIE_DOMAIN,
    
  };
  
  app.use((req, res, next) => {
    const originalSetCookie = res.cookie.bind(res);
    res.cookie = (name, value, options = {}) => {
      return originalSetCookie(name, value, {
        ...cookieSettings,
        ...options
      });
    };
    next();
  });
  
  export const startApplication = serverless(app, {
    request: (request, event, context) => {
      // Preserve original headers from API Gateway
      request.headers = {
        ...request.headers,
        ...event.headers
      };

      if (event.requestContext.eventType === 'CONNECT' || 
        event.requestContext.eventType === 'DISCONNECT' || 
        event.requestContext.eventType === 'MESSAGE') {
        // Handle WebSocket events
        return handleWebSocketEvent(event, context);
    } else {
        // Handle HTTP events using serverless-http
        return serverless(app)(event, context);
    }
      
      
    }
  });


  // Handle cookie parsing for API Gateway
      // if (event.cookies) {
      //   request.cookies = event.cookies.reduce((acc, cookie) => {
      //     const [key, value] = cookie.split('=');
      //     acc[key.trim()] = value;
      //     return acc;
      //   }, {});
      // }

      