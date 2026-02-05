const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Initialize Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    timeout: 300000, // 5 minutes
    chunk_size: 6000000 // 6MB chunks for large file uploads
});

const fs = require('fs');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

/**
 * Upload to Cloudinary (works with Buffer, Stream, or File Path)
 * @param {Buffer|Stream|String} source - Buffer, readable stream, or absolute file path
 * @param {Object} options - Upload configuration
 * @returns {Promise<Object>} Cloudinary response
 */
const uploadFromStream = (source, options = {}) => {
    return new Promise((resolve, reject) => {
        const {
            folder = 'uploads',
            resourceType = 'auto',
            publicId,
            transformation,
            allowedFormats = ['jpg', 'jpeg', 'png', 'pdf', 'gif']
        } = options;

        // If source is a string (path), we can use simpler upload method or stream it
        if (typeof source === 'string') {
            cloudinary.uploader.upload(source, {
                folder,
                resource_type: resourceType,
                public_id: publicId,
                transformation,
                allowed_formats: allowedFormats,
                use_filename: true,
                unique_filename: true
            }, async (error, result) => {
                // Cleanup temp file if it's a path
                try { await unlinkAsync(source); } catch (e) { console.warn('Temp file cleanup failed:', e.message); }

                if (error) reject(new Error(`Upload failed: ${error.message}`));
                else resolve(result);
            });
            return;
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: resourceType,
                public_id: publicId,
                transformation,
                allowed_formats: allowedFormats,
                use_filename: true,
                unique_filename: true,
                timeout: 300000
            },
            (error, result) => {
                if (error) {
                    reject(new Error(`Upload failed: ${error.message}`));
                } else {
                    resolve(result);
                }
            }
        );

        if (Buffer.isBuffer(source)) {
            uploadStream.end(source);
        } else if (source && source.pipe) {
            source.pipe(uploadStream);
        } else {
            reject(new Error('Invalid source: must be Buffer, Stream, or File Path'));
        }
    });
};

/**
 * Upload seller document directly from multer stream
 * @param {Object} file - Multer file object with stream
 * @param {String} documentType - 'country_id', 'vat_cert', or 'company_cert'
 * @param {String} sellerId - Seller's MongoDB ID
 * @returns {Promise<String>} Cloudinary secure_url
 */
const uploadSellerDocument = async (file, documentType, sellerId) => {
    if (!file) {
        throw new Error('Invalid file object');
    }

    // Support diskStorage (path) or memoryStorage (buffer/stream)
    const source = file.path || file.stream || file.buffer;
    if (!source) {
        console.error('File object missing buffer/stream:', {
            hasBuffer: !!file.buffer,
            hasStream: !!file.stream,
            fileKeys: Object.keys(file)
        });
        throw new Error('File object must have buffer or stream property');
    }

    const isPdf = file.mimetype === 'application/pdf';
    const timestamp = Date.now();
    const sanitizedOriginalName = file.originalname
        .split('.')[0]
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50);

    const publicId = `${documentType}_${sellerId}_${timestamp}_${sanitizedOriginalName}`;

    console.log('Uploading seller document:', {
        documentType,
        sellerId,
        originalName: file.originalname,
        mimetype: file.mimetype,
        isPdf,
        bufferSize: Buffer.isBuffer(source) ? source.length : 'N/A (stream)',
        publicId
    });

    // Upload directly from stream (no memory buffering)
    const result = await uploadFromStream(source, {
        folder: process.env.CLOUDINARY_SELLER_DOCS_FOLDER || 'sellers/documents',
        resourceType: isPdf ? 'raw' : 'image',
        publicId,
        transformation: isPdf
            ? undefined
            : [{ quality: 'auto:good' }, { fetch_format: 'auto' }]
    });

    console.log('Document uploaded successfully:', result.secure_url);
    return result.secure_url;
};

/**
 * Upload seller profile picture
 * @param {Object} file - Multer file object
 * @param {String} sellerId - Seller's MongoDB ID
 * @returns {Promise<String>} Cloudinary secure_url
 */
const uploadSellerProfilePicture = async (file, sellerId) => {
    if (!file) {
        throw new Error('Invalid file object');
    }

    const timestamp = Date.now();
    const publicId = `seller_${sellerId}_${timestamp}`;

    const result = await uploadFromStream(file.path || file.stream || file.buffer, {
        folder:
            process.env.CLOUDINARY_PROFILE_PICS_FOLDER || 'sellers/profile_pictures',
        resourceType: 'image',
        publicId,
        transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto:good' },
            { fetch_format: 'auto' }
        ],
        allowedFormats: ['jpg', 'jpeg', 'png', 'gif']
    });

    return result.secure_url;
};

/**
 * Delete file from Cloudinary
 * @param {String} publicId - Cloudinary public_id
 * @param {String} resourceType - 'image' or 'raw'
 * @returns {Promise<Object>}
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });
        return result;
    } catch (error) {
        console.error('Cloudinary deletion error:', error);
        throw error;
    }
};

/**
 * Extract public_id from Cloudinary URL
 * @param {String} url - Full Cloudinary URL
 * @returns {String|null} public_id or null
 */
const extractPublicId = (url) => {
    if (!url || !url.includes('cloudinary')) return null;

    try {
        const parts = url.split('/');
        const uploadIndex = parts.indexOf('upload');

        if (uploadIndex === -1) return null;

        const pathAfterUpload = parts.slice(uploadIndex + 1);
        const startIndex = pathAfterUpload[0]?.match(/^v\d+$/) ? 1 : 0;

        const publicIdWithExt = pathAfterUpload.slice(startIndex).join('/');
        const lastDotIndex = publicIdWithExt.lastIndexOf('.');

        return lastDotIndex !== -1
            ? publicIdWithExt.substring(0, lastDotIndex)
            : publicIdWithExt;
    } catch (error) {
        console.error('Error extracting public_id:', error);
        return null;
    }
};

/**
 * Validate Cloudinary configuration
 * @returns {Boolean}
 */
const isCloudinaryConfigured = () => {
    return !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
};

/**
 * Upload product image (for future use)
 * @param {Object} file - Multer file object
 * @param {String} productId - Product's MongoDB ID
 * @returns {Promise<String>} Cloudinary secure_url
 */
const uploadProductImage = async (file, productId) => {
    if (!file) {
        throw new Error('Invalid file object');
    }

    const timestamp = Date.now();
    const sanitizedName = file.originalname
        .split('.')[0]
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50);

    const publicId = `product_${productId}_${timestamp}_${sanitizedName}`;

    const result = await uploadFromStream(file.path || file.stream || file.buffer, {
        folder: 'products/images',
        resourceType: 'image',
        publicId,
        transformation: [
            { width: 1000, height: 1000, crop: 'limit' },
            { quality: 'auto:good' },
            { fetch_format: 'auto' }
        ]
    });

    return result.secure_url;
};

/**
 * Test Cloudinary connection
 * @returns {Promise<Boolean>} True if connection successful
 */
const testCloudinaryConnection = async () => {
    try {
        console.log('Testing Cloudinary connection...');
        console.log('Cloud name:', process.env.CLOUDINARY_CLOUD_NAME);
        console.log('API key configured:', !!process.env.CLOUDINARY_API_KEY);
        console.log('API secret configured:', !!process.env.CLOUDINARY_API_SECRET);

        // Test with ping
        const result = await cloudinary.api.ping();
        console.log('Cloudinary connection successful:', result);
        return true;
    } catch (error) {
        console.error('Cloudinary connection failed:', {
            message: error.message,
            http_code: error.http_code,
            name: error.name
        });
        return false;
    }
};


module.exports = {
    uploadFromStream,
    uploadProductImage,
    uploadSellerDocument,
    uploadSellerProfilePicture,
    uploadProductImage,
    deleteFromCloudinary,
    extractPublicId,
    isCloudinaryConfigured,
    testCloudinaryConnection,
    cloudinary
};