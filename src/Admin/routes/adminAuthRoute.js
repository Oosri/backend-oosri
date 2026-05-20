const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const joiSchemaValidation = require('../middleware/joiSchemaValidation');
const adminAuthSchema = require('../apiSchema/adminAuthSchema');
const accessControlValidation = require('../middleware/accessControlValidation');
const {
  otpLimiter,
  adminAuthLimiter,
  resendOtpLimiter,
  passwordResetLimiter,
} = require('../../configs/rateLimiter');


router.post('/create',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  joiSchemaValidation.validateBody(adminAuthSchema.createAdmin),
  adminAuthController.createAdmin
);

router.post('/resend-otp',
  resendOtpLimiter,
  joiSchemaValidation.validateBody(adminAuthSchema.resendOtpSchema),
  adminAuthController.resendOtp
);

router.post('/login',
  adminAuthLimiter,
  joiSchemaValidation.validateBody(adminAuthSchema.adminLogin),
  adminAuthController.adminLogin
);

router.post('/verify-2fa',
  otpLimiter,
  joiSchemaValidation.validateBody(adminAuthSchema.verify2FA),
  adminAuthController.verifyLogin2FA
);

router.post('/request-reset-password',
  passwordResetLimiter,
  joiSchemaValidation.validateBody(adminAuthSchema.requestResetPasswordSchema),
  adminAuthController.requestResetPassword
);

router.post('/password-reset/validate',
  passwordResetLimiter,
  joiSchemaValidation.validateBody(adminAuthSchema.validatePasswordTokenSchema),
  adminAuthController.validateResetToken
);

router.post('/confirm-reset-password',
  passwordResetLimiter,
  joiSchemaValidation.validateBody(adminAuthSchema.confirmResetPasswordSchema),
  adminAuthController.confirmResetPassword
);

router.post('/refresh-token',
  joiSchemaValidation.validateBody(adminAuthSchema.refreshToken),
  adminAuthController.refreshToken
);

router.get('/current-user',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  adminAuthController.getCurrentUser
);

module.exports = router;