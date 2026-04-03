const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const joiSchemaValidation = require('../middleware/joiSchemaValidation');
const adminAuthSchema = require('../apiSchema/adminAuthSchema');
const accessControlValidation = require('../middleware/accessControlValidation');


router.post('/create',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  joiSchemaValidation.validateBody(adminAuthSchema.createAdmin),
  adminAuthController.createAdmin
);

router.post('/resend-otp',
  accessControlValidation.isAdmin,
  joiSchemaValidation.validateBody(adminAuthSchema.resendOtpSchema),
  adminAuthController.resendOtp
);

router.post('/login',
  joiSchemaValidation.validateBody(adminAuthSchema.adminLogin),
  adminAuthController.adminLogin
);
router.post('/verify-2fa',
  joiSchemaValidation.validateBody(adminAuthSchema.verify2FA),
  adminAuthController.verifyLogin2FA
);
router.post('/request-reset-password',
  joiSchemaValidation.validateBody(adminAuthSchema.requestResetPasswordSchema),
  adminAuthController.requestResetPassword
);

router.post('/password-reset/validate',
  joiSchemaValidation.validateBody(adminAuthSchema.validatePasswordTokenSchema),
  adminAuthController.validateResetToken
);

router.post('/confirm-reset-password',
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