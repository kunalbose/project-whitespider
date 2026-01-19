import Redis from 'ioredis';

const getRedisUrl = () => {
    if (process.env.REDIS_URL) {
        return process.env.REDIS_URL;
    }
    throw new Error('REDIS_URL is not defined in environment variables');
}

// Global redis instance to prevent multiple connections in serverless environment
const globalForRedis = global as unknown as { redis: Redis };

export const redis =
    globalForRedis.redis ||
    new Redis(getRedisUrl(), {
        maxRetriesPerRequest: null,
    });

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
