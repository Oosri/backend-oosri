// middlewares/smartCloudinaryUpload.middleware.js
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');

// Initialize Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    timeout: 300000, // 5 minutes
    chunk_size: 6000000 // 6MB chunks for large file uploads
});

/**
 * Memory storage for documents
 * (Files are buffered in memory for manual Cloudinary upload in controller)
 */
const documentStorage = multer.memoryStorage();

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