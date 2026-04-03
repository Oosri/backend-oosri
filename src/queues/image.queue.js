const { Queue } = require('bullmq');
const redis = require('../configs/redis');

const IMAGE_QUEUE_NAME = 'image-queue';

const imageQueue = new Queue(IMAGE_QUEUE_NAME, {
    connection: redis
});

/**
 * Add an image processing job to the queue
 * @param {string} type - The type of image processing (e.g., 'seller-profile-picture')
 * @param {Object} data - The data required for the processing
 */
const addImageJob = async (type, data) => {
    try {
        await imageQueue.add(type, data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000
            },
            removeOnComplete: true,
            removeOnFail: false
        });
        console.log(`Job added to image queue: ${type}`);
    } catch (error) {
        console.error(`Failed to add job to image queue: ${error.message}`);
    }
};

module.exports = {
    imageQueue,
    addImageJob
};
