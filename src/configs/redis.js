const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redisConfig = {
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

const redis = new Redis(redisUrl, redisConfig);

redis.on('connect', () => {
    console.log('Successfully Connected to Redis...');
});

redis.on('error', (err) => {
    console.error('Redis connection error:', err.message);
});

module.exports = redis;
