const express = require('express');
const { sellerAccountSignup, validateOtpCode, sellerAccountSignin } = require('../controllers/sellerAuth.controller');

const router = express.Router();

router.post('/sign-up', sellerAccountSignup);
router.post('/verify-otp', validateOtpCode);
router.post('/sign-in', sellerAccountSignin);

module.exports = router