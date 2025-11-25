// middlewares/smartCloudinaryUpload.middleware.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');

// Initialize Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    timeout: 120000
});

/**
 * Direct Cloudinary storage (no memory buffering)
 * Used for documents that always get uploaded
 */
const documentStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const isPdf = file.mimetype === 'application/pdf';
        const timestamp = Date.now();
        const sellerId = req.params.sellerId;

        // Determine document type from field name
        let prefix = 'document';
        if (file.fieldname === 'countryIdentificationCard') {
            prefix = 'country_id';
        } else if (file.fieldname === 'vatCertificate') {
            prefix = 'vat_cert';
        } else if (file.fieldname === 'companyCertificate') {
            prefix = 'company_cert';
        }

        const sanitizedName = file.originalname
            .split('.')[0]
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 50);

        return {
            folder: process.env.CLOUDINARY_SELLER_DOCS_FOLDER || 'sellers/documents',
            resource_type: isPdf ? 'raw' : 'image',
            public_id: `${prefix}_${sellerId}_${timestamp}_${sanitizedName}`,
            allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'gif'],
            transformation: isPdf ? undefined : [
                { quality: 'auto:good' },
                { fetch_format: 'auto' }
            ]
        };
    }
});

/**
 * Memory storage for profile pictures
 * (Needed because of conditional avatar logic)
 */
const profilePictureStorage = multer.memoryStorage();

/**
 * File validation
 */
const checkFileType = (file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|pdf/;
    const extname = filetypes.test(
        path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(
            new Error(
                'Invalid file type. Only JPEG, JPG, PNG, GIF, and PDF files are allowed.'
            )
        );
    }
};

/**
 * Document upload (streams directly to Cloudinary)
 */
const documentUpload = multer({
    storage: documentStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 3
    },
    fileFilter: (req, file, cb) => {
        checkFileType(file, cb);
    }
});

/**
 * Profile picture upload (uses memory for conditional logic)
 */
const profilePictureUpload = multer({
    storage: profilePictureStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Only allow images for profile pictures
        const imageTypes = /jpeg|jpg|png|gif/;
        const extname = imageTypes.test(
            path.extname(file.originalname).toLowerCase()
        );
        const mimetype = imageTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Profile pictures must be JPEG, JPG, PNG, or GIF'));
        }
    }
});


/**
 * Error handling middleware
 */
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'File size exceeds 5MB limit'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Too many files uploaded'
            });
        }
    }

    if (err) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: err.message || 'File upload error'
        });
    }

    next();
};

module.exports = {
    documentUpload,
    profilePictureUpload,
    handleMulterError,
    cloudinary
};