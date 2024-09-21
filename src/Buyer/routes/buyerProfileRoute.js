const express = require('express');
const router = express.Router();
const buyerProfileController = require('../controllers/buyerProfileController');
const joiSchemaValidation = require('../middlewares/joiSchemaValidation');
const buyerProfileSchema = require('../apiSchema/buyerProfileSchema');
const accessControlValidation = require('../middlewares/accessControlValidation');
const upload = require('../middlewares/fileUploadMiddleware');


router.put('/update-profile',
  accessControlValidation.validateToken,
  joiSchemaValidation.validateBody(buyerProfileSchema.updateBuyerProfile),
  buyerProfileController.updateBuyerProfile
);

router.post('/change-password', 
  accessControlValidation.validateToken,
  joiSchemaValidation.validateBody(buyerProfileSchema.changeBuyerPassword),
  buyerProfileController.changePassword
);



  router.post('/profile-image', 
    accessControlValidation.validateToken,
    upload.single('profileImage'), 
    buyerProfileController.uploadBuyerProfileImage
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