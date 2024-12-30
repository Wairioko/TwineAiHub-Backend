import { cookieOptions } from "./constants.mjs";
import dotenv from "dotenv"
import {promisify} from "util"



dotenv.config()
// init openai

// Create a new Redis client instance
class redisClient {
    constructor(config = {}) {
        this.client = Redis.createClient({
            url: config.url || process.env.REDIS_URL,
            password: config.password || process.env.REDIS_PASSWORD,
            socket: {
                reconnectStrategy: (retries) => {
                    // Maximum retry delay of 3 seconds
                    return Math.min(retries * 1000, 3000);
                }
            }
        });

        // Promisify commonly used Redis commands
        this.get = promisify(this.client.get).bind(this.client);
        this.set = promisify(this.client.set).bind(this.client);
        this.del = promisify(this.client.del).bind(this.client);
        this.exists = promisify(this.client.exists).bind(this.client);
        this.expire = promisify(this.client.expire).bind(this.client);

        // Set up event handlers
        this.client.on('connect', () => {
            console.log('Redis client connected');
        });

        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        this.client.on('reconnecting', () => {
            console.log('Redis client reconnecting...');
        });

        this.client.on('end', () => {
            console.log('Redis client disconnected');
        });
    }

    async connect() {
        try {
            await this.client.connect();
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            await this.client.quit();
        } catch (error) {
            console.error('Error disconnecting from Redis:', error);
            throw error;
        }
    }

    // Helper method for setting key with expiration
    async setEx(key, value, expireSeconds) {
        try {
            await this.set(key, JSON.stringify(value));
            await this.expire(key, expireSeconds);
        } catch (error) {
            console.error('Error setting value with expiration:', error);
            throw error;
        }
    }

    // Helper method for getting and parsing JSON values
    async getJson(key) {
        try {
            const value = await this.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Error getting JSON value:', error);
            throw error;
        }
    }
}



  


function clearAuthCookies(res) {
    res.clearCookie('authToken', cookieOptions);
    res.clearCookie('anonymousId', cookieOptions);
    res.clearCookie('userId', cookieOptions);
    res.clearCookie('anonToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
}

export default clearAuthCookies


// Helper function to set cache
export const setCache = async (key, value, expiry = 3600) => {
    try {
        if (!redisClient.isReady) return;
        await redisClient.setEx(key, expiry, JSON.stringify(value));
    } catch (error) {
        console.error('Redis set error:', error);
    }
};


// Helper function to get cache
export const getCache = async (key) => {
    try {
        if (!redisClient.isReady) return null;
        const cached = await redisClient.get(key);
        return cached ? JSON.parse(cached) : null;
    } catch (error) {
        console.error('Redis get error:', error);
        return null;
    }
};


export const parseCookies = (cookieHeader) => {
    const cookies = {};
    if (!cookieHeader) return cookies;

    cookieHeader.split(";").forEach((cookie) => {
        const parts = cookie.split("=");
        const name = parts[0]?.trim();
        if (name) {
            cookies[name] = parts[1]?.trim() || "";
        }
    });

    return cookies;
}

