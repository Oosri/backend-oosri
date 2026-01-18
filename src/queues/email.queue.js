const { Queue } = require('bullmq');
const redis = require('../configs/redis');

const EMAIL_QUEUE_NAME = 'email-queue';

const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
    connection: redis
});

/**
 * Add an email job to the queue
 * @param {string} type - The type of email (e.g., 'seller-order', 'buyer-confirmation')
 * @param {Object} data - The data required for the email
 */
const addEmailJob = async (type, data) => {
    try {
        await emailQueue.add(type, data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000
            },
            removeOnComplete: true,
            removeOnFail: false
        });
        console.log(`Job added to email queue: ${type}`);
    } catch (error) {
        console.error(`Failed to add job to email queue: ${error.message}`);
        // Fallback or just log as per senior engineering plan
    }
};

module.exports = {
    emailQueue,
    addEmailJob
};
