const express = require('express');
const router = express.Router();
const buyerAuthController = require('../controllers/buyerAuthController');
const joiSchemaValidation = require('../middlewares/joiSchemaValidation');
const buyerAuthSchema = require('../apiSchema/buyerAuthSchema');

router.post('/register',
  joiSchemaValidation.validateBody(buyerAuthSchema.registerBuyer),
  buyerAuthController.registerBuyer
);

router.post('/resend-otp', 
  joiSchemaValidation.validateBody(buyerAuthSchema.resendOtpSchema),
  buyerAuthController.resendOtp
);

router.post('/confirm-otp', 
  joiSchemaValidation.validateBody(buyerAuthSchema.confirmOtp),
  buyerAuthController.confirmOtp
);

router.post('/login',
  joiSchemaValidation.validateBody(buyerAuthSchema.buyerLogin),
  buyerAuthController.buyerLogin
);

router.post('/request-reset-password', 
    joiSchemaValidation.validateBody(buyerAuthSchema.requestResetPasswordSchema),
    buyerAuthController.requestResetPassword
  );
  
  router.post('/confirm-reset-password',
    joiSchemaValidation.validateBody(buyerAuthSchema.confirmResetPasswordSchema),
    buyerAuthController.confirmResetPassword
  );

  router.post('/refresh-token',
    joiSchemaValidation.validateBody(buyerAuthSchema.refreshToken),
    buyerAuthController.refreshToken
  );


module.exports = router;