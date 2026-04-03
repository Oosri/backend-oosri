const { Worker } = require('bullmq');
const redis = require('../configs/redis');
const Seller = require('../models/sellerModel');
const { uploadSellerProfilePicture } = require('../utils/cloudinary');
const fs = require('fs');
const path = require('path');

const IMAGE_QUEUE_NAME = 'image-queue';

const imageWorker = new Worker(
    IMAGE_QUEUE_NAME,
    async (job) => {
        const { type, data } = job;

        if (type === 'seller-profile-picture') {
            const { sellerId, file } = data;

            try {
                console.log(`Processing profile picture for seller: ${sellerId}`);

                // 1. Upload to Cloudinary
                // Multer file object needs to be reconstructed or passed with path
                const profilePictureUrl = await uploadSellerProfilePicture(file, sellerId);

                // 2. Update Seller record
                await Seller.findByIdAndUpdate(sellerId, {
                    profilePicture: profilePictureUrl
                });

                console.log(`Successfully updated profile picture for seller: ${sellerId}`);

                // Cleanup temporary local file if it exists
                if (file.path && fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                    console.log(`Cleaned up temp file: ${file.path}`);
                }

            } catch (error) {
                console.error(`Error processing profile picture for seller ${sellerId}:`, error.message);
                throw error; // Let BullMQ handle retries
            }
        } else if (type === 'seller-document') {
            const { sellerId, file, documentType, businessType, fieldName } = data;

            try {
                console.log(`Processing ${documentType} for seller: ${sellerId}`);

                // Import uploadSellerDocument
                const { uploadSellerDocument } = require('../utils/cloudinary');

                // 1. Upload to Cloudinary
                const documentUrl = await uploadSellerDocument(file, documentType, sellerId);

                // 2. Update Seller record based on business type
                const seller = await Seller.findById(sellerId);
                if (!seller) {
                    throw new Error('Seller not found');
                }

                if (businessType === 'Personal') {
                    seller.personalBusinessAccount = seller.personalBusinessAccount || {};
                    seller.personalBusinessAccount[fieldName] = documentUrl;
                } else if (businessType === 'Corporate') {
                    seller.corporateBusinessAccount = seller.corporateBusinessAccount || {};
                    seller.corporateBusinessAccount[fieldName] = documentUrl;
                }

                await seller.save();
                console.log(`Successfully updated ${documentType} for seller: ${sellerId}`);

                // Cleanup temporary local file if it exists
                if (file.path && fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                    console.log(`Cleaned up temp file: ${file.path}`);
                }

            } catch (error) {
                console.error(`Error processing ${documentType} for seller ${sellerId}:`, error.message);
                throw error; // Let BullMQ handle retries
            }
        }
    },
    {
        connection: redis,
        concurrency: 5
    }
);

imageWorker.on('completed', (job) => {
    console.log(`Image job ${job.id} completed`);
});

imageWorker.on('failed', (job, err) => {
    console.error(`Image job ${job.id} failed: ${err.message}`);
});

module.exports = imageWorker;
