const express = require('express');
const router = express.Router();
const buyerAuthController = require('../controllers/buyerAuthController');
const joiSchemaValidation = require('../middlewares/joiSchemaValidation');
const buyerAuthSchema = require('../apiSchema/buyerAuthSchema');
const passport = require('passport');
const accessControlValidation = require('../middlewares/accessControlValidation');
const { setBuyerAuthCookies } = require('../../utils/authCookies');
const {
  otpLimiter,
  authLimiter,
  registrationLimiter,
  resendOtpLimiter,
  passwordResetLimiter,
} = require('../../configs/rateLimiter');

const getBuyerFrontendUrl = () => {
  const configuredUrl =
    process.env.BUYER_FRONTEND_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_FRONTEND_URL;

  if (configuredUrl) {
    return configuredUrl;
  }

  return process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://oosri.com';
};

const getBuyerLoginUrl = () => `${getBuyerFrontendUrl().replace(/\/$/, '')}/login`;


router.post('/register',
  registrationLimiter,
  joiSchemaValidation.validateBody(buyerAuthSchema.registerBuyer),
  buyerAuthController.registerBuyer
);

router.post('/resend-otp',
  resendOtpLimiter,
  joiSchemaValidation.validateBody(buyerAuthSchema.resendOtpSchema),
  buyerAuthController.resendOtp
);

router.post('/confirm-otp',
  otpLimiter,
  joiSchemaValidation.validateBody(buyerAuthSchema.confirmOtp),
  buyerAuthController.confirmOtp
);

router.post('/login',
  authLimiter,
  joiSchemaValidation.validateBody(buyerAuthSchema.buyerLogin),
  buyerAuthController.buyerLogin
);

router.post('/google-login',
  authLimiter,
  joiSchemaValidation.validateBody(buyerAuthSchema.googleLogin),
  buyerAuthController.googleLogin
);

router.post('/google-userinfo',
  authLimiter,
  joiSchemaValidation.validateBody(buyerAuthSchema.googleUserInfo),
  buyerAuthController.googleUserInfo
);

router.post('/request-reset-password',
  passwordResetLimiter,
  joiSchemaValidation.validateBody(buyerAuthSchema.requestResetPasswordSchema),
  buyerAuthController.requestResetPassword
);

router.post('/confirm-reset-password',
  passwordResetLimiter,
  joiSchemaValidation.validateBody(buyerAuthSchema.confirmResetPasswordSchema),
  buyerAuthController.confirmResetPassword
);

  router.post('/refresh-token',
    joiSchemaValidation.validateBody(buyerAuthSchema.refreshToken),
    buyerAuthController.refreshToken
  );

  router.post('/logout',
    accessControlValidation.optional,
    buyerAuthController.logout
  );

  router.get('/current-user', 
    accessControlValidation.validateToken,
    buyerAuthController.getCurrentUser
  );







router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: getBuyerLoginUrl(), session: false }),
  (req, res) => {
    const { user, accessToken, refreshToken } = req.user;

    if (!accessToken || !refreshToken) {
      res.redirect(getBuyerLoginUrl());
      return;
    }
    setBuyerAuthCookies(res, { accessToken, refreshToken });
    res.redirect(getBuyerFrontendUrl());
  }
);



module.exports = router;
