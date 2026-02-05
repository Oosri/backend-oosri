const redis = require('../src/configs/redis');

async function flushCache() {
    try {
        console.log('Flushing Redis cache...');
        await redis.flushall();
        console.log('Redis cache flushed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error flushing Redis:', err.message);
        process.exit(1);
    }
}

flushCache();
