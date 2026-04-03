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
    verifyDocumentUpload
} = require('../controllers/sellerAuth.controller');
const { sellerAuth } = require('../middlewares/auth.middleware');
const upload = require('../Buyer/middlewares/fileUploadMiddleware');
const { documentUpload, handleMulterError } = require('../middlewares/cloudinaryUploadMiddleware');


const router = express.Router();

router.post('/sign-up', upload.single('profilePicture'), sellerAccountSignup);
router.post('/resend-otp', resendOtpCode);
router.post('/verify-otp', validateOtpCode);
router.post('/sign-in', sellerAccountSignin);
router.post('/forgot-password', sellerForgetPassword);
router.post('/reset-password', sellerResetPassword);
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

module.exports = router