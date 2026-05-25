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
 * Generate presigned URL for product image upload.
 *
 * The transformation string is driven by the CLOUDINARY_PRODUCTS_TRANSFORM
 * environment variable so that the value is always in sync between what is
 * cryptographically signed on the server and what the client forwards to
 * Cloudinary.  A mismatch here is the root cause of "Invalid Signature"
 * errors in production.
 *
 * @param {string} sellerId - Seller ID
 * @param {string} fileName - Original file name (used to build the public_id)
 * @returns {Object} - Upload URL and ALL signed parameters (client must send
 *                     these verbatim – no client-side mutation allowed)
 */
const generateProductPresignedUrl = (sellerId, fileName = 'image') => {
    const timestamp = Math.round(Date.now() / 1000);

    // Sanitize filename: keep only safe chars, cap at 50 chars
    const sanitizedName = (fileName || 'image')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 50);

    const publicId = `product_${sellerId}_${timestamp}_${sanitizedName}`;
    const folder = process.env.CLOUDINARY_PRODUCTS_FOLDER || 'products/images';

    // ─── SINGLE SOURCE OF TRUTH for the transformation ─────────────────────
    // Read from env so that dev / staging / production can each have their own
    // value without requiring a code change.  Whatever is set here is ALSO
    // what the client must forward to Cloudinary — eliminating the mismatch.
    const transformString =
        process.env.CLOUDINARY_PRODUCTS_TRANSFORM ||
        'w_2000,h_2000,c_limit,q_auto:good,f_auto';
    // ───────────────────────────────────────────────────────────────────────

    const tags = `product,seller_${sellerId},pending`;
    const allowedFormats = 'jpg,png,jpeg,webp,avif';

    // ALL params that will be sent to Cloudinary must be included here.
    // Order does not matter — we sort below — but nothing must be left out.
    const paramsToSign = {
        allowed_formats: allowedFormats,
        folder,
        public_id: publicId,
        tags,
        timestamp,
        transformation: transformString,
    };

    // Cloudinary signature: sort keys alphabetically, join as key=value pairs,
    // concatenate the API secret, then SHA-1 hash the whole string.
    const paramsString = Object.keys(paramsToSign)
        .sort()
        .map(key => `${key}=${paramsToSign[key]}`)
        .join('&');

    const signature = crypto
        .createHash('sha1')
        .update(paramsString + process.env.CLOUDINARY_API_SECRET)
        .digest('hex');

    const uploadUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;

    // Return every signed parameter so the client can forward them verbatim.
    return {
        url: uploadUrl,
        signature,
        timestamp,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        // Signed upload params — client MUST NOT alter these values
        publicId,
        folder,
        transformation: transformString,
        allowed_formats: allowedFormats,
        tags,
        resourceType: 'image',
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

    // Accept URLs from either the dev or live Cloudinary account
    const cloudNames = [
        process.env.CLOUDINARY_CLOUD_NAME,
        process.env.CLOUDINARY_CLOUD_NAME_LIVE,
    ].filter(Boolean);

    if (cloudNames.length === 0) return false;

    const validPatterns = cloudNames.flatMap(name => [
        `https://res.cloudinary.com/${name}/`,
        `https://cloudinary.com/${name}/`,
    ]);

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
    generateProductPresignedUrl,
    validateCloudinaryUrl,
    extractPublicId
};
