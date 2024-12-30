import jwt from 'jsonwebtoken';
import { UserModel } from '../schema/Users.mjs';
import dotenv from 'dotenv'


dotenv.config();


export const checkAuth = (req, res, next) => {
    try {
        const token = req.cookies.authToken;

        if (!token) {
            return res.status(401).json({
                body: JSON.stringify({
                    isAuthenticated: false,
                    message: "No authentication token found"
                })
            });
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(401).json({
                    body: JSON.stringify({ 
                        isAuthenticated: false, 
                        message: "Invalid authentication token" 
                    })
                });
            }

            // Fetch user to get additional details
            UserModel.findById(decoded.userId)
                .then(user => {
                    if (!user) {
                        return res.status(401).json({
                            body: JSON.stringify({
                                isAuthenticated: false,
                                message: "User not found"
                            })
                        });
                    }

                    // Check subscription status if needed
                    const isSubscribed = user.subscriptionType !== 'none';

                    return res.status(200).json({
                        body: JSON.stringify({
                            isAuthenticated: true,
                            isSubscribed: isSubscribed,
                            user: {
                                id: user._id,
                                username: user.username,
                                email: user.email
                            },
                            message: "Authentication valid"
                        })
                    });
                })
                .catch(error => {
                    console.error('User lookup error:', error);
                    return res.status(500).json({
                        body: JSON.stringify({ 
                            isAuthenticated: false, 
                            message: "Error checking authentication status" 
                        })
                    });
                });
        });
    } catch (error) {
        console.error('Auth status check error:', error);
        res.status(500).json({ 
            body: JSON.stringify({
                isAuthenticated: false, 
                message: "Error checking authentication status" 
            })
        });
    }
};