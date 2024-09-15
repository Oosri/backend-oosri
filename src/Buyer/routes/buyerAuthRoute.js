const express = require('express');
const router = express.Router();
const buyerAuthController = require('../controllers/buyerAuthController');
const joiSchemaValidation = require('../middlewares/joiSchemaValidation');
const buyerAuthSchema = require('../apiSchema/buyerAuthSchema');
const accessControlValidation = require('../middlewares/accessControlValidation')

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

  router.get('/current-user', 
    accessControlValidation.validateToken,
    buyerAuthController.getCurrentUser
  );






// router.get('/auth/google',
//   passport.authenticate('google', { scope: ['profile', 'email'] })
// );

// router.get('/auth/google/callback',
//   passport.authenticate('google', { failureRedirect: '/login', session: false }),
//   async (req, res) => {
//     const buyer = req.user;
//     const lastLogin = mongoDbDataFormat.formatCurrentDate();
//     const tokenPayload = {
//       id: buyer._id,
//       fullName: buyer.fullName,
//     };

//     const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '3d' });
//     const refreshToken = jwt.sign({ id: buyer._id }, process.env.JWT_SECRET || 'my-secret-key', { expiresIn: '7d' });

//     res.json({
//       message: 'Login success',
//       user: buyer.toObject(),
//       accessToken: accessToken,
//       refreshToken: refreshToken,
//       lastLogin: lastLogin  
//     });
//   }
// );




module.exports = router;