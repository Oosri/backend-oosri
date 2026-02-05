const crypto = require('crypto');

/**
 * Generate Cloudinary upload signature
 * @param {Object} params - Upload parameters
 * @returns {Object} - Signature and timestamp
 */
const generateUploadSignature = (params) => {
    const timestamp = Math.round(Date.now() / 1000);

    // Add timestamp to params
    const paramsWithTimestamp = {
        ...params,
        timestamp
    };

    // Sort parameters alphabetically
    const sortedParams = Object.keys(paramsWithTimestamp)
        .sort()
        .map(key => `${key}=${paramsWithTimestamp[key]}`)
        .join('&');

    // Create signature using HMAC SHA256
    const signature = crypto
        .createHash('sha256')
        .update(sortedParams + process.env.CLOUDINARY_API_SECRET)
        .digest('hex');

    return {
        signature,
        timestamp
    };
};

/**
 * Generate presigned URL for document upload
 * @param {string} sellerId - Seller ID
 * @param {string} documentType - Type of document (vat_cert, company_cert, country_id)
 * @returns {Object} - Upload URL and parameters
 */
const generatePresignedUrl = (sellerId, documentType) => {
    const timestamp = Math.round(Date.now() / 1000);
    const publicId = `seller_${sellerId}_${documentType}_${timestamp}`;
    const folder = process.env.CLOUDINARY_DOCUMENTS_FOLDER || 'sellers/documents';

    // Parameters for upload (EXCLUDING those that should not be signed)
    const paramsToSign = {
        folder: folder,
        public_id: publicId,
        timestamp: timestamp
    };

    // Generate signature string
    const paramsString = Object.keys(paramsToSign)
        .sort()
        .map(key => `${key}=${paramsToSign[key]}`)
        .join('&');

    // Create signature using SHA-1 (Cloudinary default)
    const signature = crypto
        .createHash('sha1')
        .update(paramsString + process.env.CLOUDINARY_API_SECRET)
        .digest('hex');

    // Construct upload URL
    const uploadUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`;

    return {
        url: uploadUrl,
        publicId: publicId,
        folder: folder,
        signature: signature,
        timestamp: timestamp,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        resource_type: 'auto'
    };
};

/**
 * Validate that a URL is from our Cloudinary account
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid Cloudinary URL
 */
const validateCloudinaryUrl = (url) => {
    if (!url || typeof url !== 'string') {
        return false;
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const validPatterns = [
        `https://res.cloudinary.com/${cloudName}/`,
        `https://cloudinary.com/${cloudName}/`
    ];

    return validPatterns.some(pattern => url.startsWith(pattern));
};

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} - Public ID or null
 */
const extractPublicId = (url) => {
    if (!validateCloudinaryUrl(url)) {
        return null;
    }

    try {
        // Extract public ID from URL
        // Format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/v{version}/{public_id}.{format}
        const urlParts = url.split('/');
        const uploadIndex = urlParts.indexOf('upload');

        if (uploadIndex === -1) {
            return null;
        }

        // Get everything after 'upload/v{version}/'
        const publicIdWithExt = urlParts.slice(uploadIndex + 2).join('/');

        // Remove file extension
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');

        return publicId;
    } catch (error) {
        console.error('Error extracting public ID:', error);
        return null;
    }
};

module.exports = {
    generateUploadSignature,
    generatePresignedUrl,
    validateCloudinaryUrl,
    extractPublicId
};
