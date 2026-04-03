const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();

const getRedisUrl = () => {
    if (process.env.REDIS_URL) {
        return process.env.REDIS_URL;
    }
    if (process.env.REDISHOST) {
        const port = process.env.REDISPORT || 6379;
        const user = process.env.REDISUSER ? `${process.env.REDISUSER}` : '';
        const password = process.env.REDISPASSWORD ? `:${process.env.REDISPASSWORD}` : '';
        const auth = user || password ? `${user}${password}@` : '';
        return `redis://${auth}${process.env.REDISHOST}:${port}`;
    }
    return 'redis://127.0.0.1:6379';
};

const redisUrl = getRedisUrl();

const redisConfig = {
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

const redis = new Redis(redisUrl, redisConfig);
redis.redisUrl = redisUrl; // Export url for workers that need new connections

redis.on('connect', () => {
    console.log('Successfully Connected to Redis...');
});

redis.on('error', (err) => {
    console.error('Redis connection error:', err.message);
});

module.exports = redis;
