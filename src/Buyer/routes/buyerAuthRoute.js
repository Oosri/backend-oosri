const express = require('express');
const router = express.Router();
const buyerAuthController = require('../controllers/buyerAuthController');
const joiSchemaValidation = require('../middlewares/joiSchemaValidation');
const buyerAuthSchema = require('../apiSchema/buyerAuthSchema');
const passport = require('passport');
const accessControlValidation = require('../middlewares/accessControlValidation');
const { setBuyerAuthCookies } = require('../../utils/authCookies');


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

router.post('/google-login',
  joiSchemaValidation.validateBody(buyerAuthSchema.googleLogin),
  buyerAuthController.googleLogin
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
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  (req, res) => {
    const { user, accessToken, refreshToken } = req.user;

    if (!accessToken || !refreshToken) {
      res.status(400).json({ message: 'Tokens not available' });
      return;
    }
    setBuyerAuthCookies(res, { accessToken, refreshToken });
    const redirectUrl = 'https://www.buildafrica.store/';
    res.redirect(redirectUrl);
  }
);



module.exports = router;
