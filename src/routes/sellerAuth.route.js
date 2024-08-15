const express = require('express');
const { sellerAccountSignup, validateOtpCode, sellerAccountSignin, sellerBusinessRegistration, resendOtpCode } = require('../controllers/sellerAuth.controller');
const { sellerAuth } = require('../middlewares/auth.middleware');
const { upload } = require('../utils/fileUpload');

const router = express.Router();

router.post('/sign-up', upload.single('profilePicture'), sellerAccountSignup);
router.post('/resend-otp', resendOtpCode);
router.post('/verify-otp', validateOtpCode);
router.post('/sign-in', sellerAccountSignin);
router.post('/business-registration', sellerAuth, upload.fields([
    { name: 'countryIdentificationCard', maxCount: 1 },
    { name: 'vatCertificate', maxCount: 1 },
    { name: 'companyCertificate', maxCount: 1 },

]), sellerBusinessRegistration);


module.exports = router