const express = require('express');
const { sellerAccountSignup, validateOtpCode, sellerAccountSignin, sellerBusinessRegistration, resendOtpCode, userProfile, sellerForgetPassword, sellerResetPassword } = require('../controllers/sellerAuth.controller');
const { sellerAuth } = require('../middlewares/auth.middleware');
const upload = require('../Buyer/middlewares/fileUploadMiddleware');


const router = express.Router();

router.post('/sign-up', upload.single('profilePicture'), sellerAccountSignup);
router.post('/resend-otp', resendOtpCode);
router.post('/verify-otp', validateOtpCode);
router.post('/sign-in', sellerAccountSignin);
router.post('/forgot-password', sellerForgetPassword);
router.post('/reset-password', sellerResetPassword);
router.post('/business-registration', sellerAuth, upload.fields([
    { name: 'countryIdentificationCard', maxCount: 1 },
    { name: 'vatCertificate', maxCount: 1 },
    { name: 'companyCertificate', maxCount: 1 },
]), sellerBusinessRegistration);
router.get('/profile', sellerAuth, userProfile);

module.exports = router