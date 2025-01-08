const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const joiSchemaValidation = require('../middleware/joiSchemaValidation');
const adminAuthSchema = require('../apiSchema/adminAuthSchema');
const accessControlValidation = require('../middleware/accessControlValidation');


router.post('/create',
  accessControlValidation.isAdmin,
  joiSchemaValidation.validateBody(adminAuthSchema.createAdmin),
  adminAuthController.createAdmin
);

router.post('/resend-otp', 
  accessControlValidation.isAdmin,
  joiSchemaValidation.validateBody(adminAuthSchema.resendOtpSchema),
  adminAuthController.resendOtp
);

router.post('/confirm-otp', 
  accessControlValidation.isAdmin,
  joiSchemaValidation.validateBody(adminAuthSchema.confirmOtp),
  adminAuthController.confirmOtp
);

router.post('/login',
  accessControlValidation.isAdmin,
  joiSchemaValidation.validateBody(adminAuthSchema.adminLogin),
  adminAuthController.adminLogin
);

router.post('/request-reset-password', 
  accessControlValidation.isAdmin,
    joiSchemaValidation.validateBody(adminAuthSchema.requestResetPasswordSchema),
    adminAuthController.requestResetPassword
  );
  
  router.post('/confirm-reset-password',
    accessControlValidation.isAdmin,
    joiSchemaValidation.validateBody(adminAuthSchema.confirmResetPasswordSchema),
    adminAuthController.confirmResetPassword
  );

  router.post('/refresh-token',
    accessControlValidation.isAdmin,
    joiSchemaValidation.validateBody(adminAuthSchema.refreshToken),
    adminAuthController.refreshToken
  );

  router.get('/current-user', 
    accessControlValidation.isAdmin,
    accessControlValidation.validateToken,
    adminAuthController.getCurrentUser
  );

module.exports = router;