const express = require('express');
const {
    sellerAccountSignup,
    validateOtpCode,
    sellerAccountSignin,
    sellerBusinessRegistration,
    resendOtpCode,
    userProfile,
    sellerForgetPassword,
    sellerResetPassword,
    getDocumentUploadUrls,
    cloudinaryWebhook,
    verifyDocumentUpload,
    sellerRefreshToken,
    sellerSignOut,
    acceptTerms,
} = require('../controllers/sellerAuth.controller');
const { sellerAuth } = require('../middlewares/auth.middleware');
const upload = require('../Buyer/middlewares/fileUploadMiddleware');
const { documentUpload, handleMulterError } = require('../middlewares/cloudinaryUploadMiddleware');
const {
    otpLimiter,
    authLimiter,
    registrationLimiter,
    resendOtpLimiter,
    passwordResetLimiter,
} = require('../configs/rateLimiter');


const router = express.Router();

router.post('/sign-up', registrationLimiter, upload.single('profilePicture'), sellerAccountSignup);
router.post('/resend-otp', resendOtpLimiter, resendOtpCode);
router.post('/verify-otp', otpLimiter, validateOtpCode);
router.post('/sign-in', authLimiter, sellerAccountSignin);
router.post('/forgot-password', passwordResetLimiter, sellerForgetPassword);
router.post('/reset-password', passwordResetLimiter, sellerResetPassword);
router.post('/business-registration',
    sellerAuth,
    documentUpload.fields([
        { name: 'countryIdentificationCard', maxCount: 1 },
        { name: 'vatCertificate', maxCount: 1 },
        { name: 'companyCertificate', maxCount: 1 },
    ]),
    handleMulterError,
    sellerBusinessRegistration
);
router.get('/profile', sellerAuth, userProfile);

// Presigned URL pattern endpoints
router.post('/get-document-upload-urls', sellerAuth, getDocumentUploadUrls);
router.post('/cloudinary-webhook', cloudinaryWebhook);
router.get('/verify-document/:publicId', sellerAuth, verifyDocumentUpload);

router.post('/refresh-token', sellerRefreshToken);
router.post('/sign-out', sellerSignOut);
router.post('/accept-terms', sellerAuth, acceptTerms);

module.exports = router