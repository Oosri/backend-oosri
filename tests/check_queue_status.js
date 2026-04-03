require('dotenv').config();
const Redis = require('ioredis');

async function checkBullMQJobs() {
    try {
        const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
            maxRetriesPerRequest: null
        });

        console.log('=== BullMQ Queue Status ===\n');

        // Check image-queue
        const imageQueueKeys = await redis.keys('bull:image-queue:*');
        console.log(`📸 Image Queue Keys: ${imageQueueKeys.length} total`);

        // Check for waiting jobs
        const waitingJobs = await redis.lrange('bull:image-queue:wait', 0, -1);
        console.log(`  ⏳ Waiting jobs: ${waitingJobs.length}`);

        // Check for active jobs
        const activeJobs = await redis.lrange('bull:image-queue:active', 0, -1);
        console.log(`  🔄 Active jobs: ${activeJobs.length}`);

        // Check for completed jobs
        const completedJobs = await redis.zcard('bull:image-queue:completed');
        console.log(`  ✅ Completed jobs: ${completedJobs}`);

        // Check for failed jobs
        const failedJobs = await redis.zcard('bull:image-queue:failed');
        console.log(`  ❌ Failed jobs: ${failedJobs}`);

        // Show recent job details if any
        if (waitingJobs.length > 0) {
            console.log('\n--- Waiting Jobs Details ---');
            for (let i = 0; i < Math.min(3, waitingJobs.length); i++) {
                const jobData = await redis.get(`bull:image-queue:${waitingJobs[i]}`);
                if (jobData) {
                    const job = JSON.parse(jobData);
                    console.log(`\nJob ${waitingJobs[i]}:`);
                    console.log(`  Type: ${job.name}`);
                    console.log(`  Seller ID: ${job.data?.sellerId}`);
                    console.log(`  Document Type: ${job.data?.documentType || 'N/A'}`);
                }
            }
        }

        if (failedJobs > 0) {
            console.log('\n--- Failed Jobs ---');
            const failed = await redis.zrange('bull:image-queue:failed', 0, 2);
            for (const jobId of failed) {
                const jobData = await redis.get(`bull:image-queue:${jobId}`);
                if (jobData) {
                    const job = JSON.parse(jobData);
                    console.log(`\nJob ${jobId}:`);
                    console.log(`  Type: ${job.name}`);
                    console.log(`  Error: ${job.failedReason || 'Unknown'}`);
                }
            }
        }

        await redis.quit();
        console.log('\n✅ Queue check complete');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkBullMQJobs();
