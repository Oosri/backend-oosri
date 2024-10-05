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
  accessControlValidation.validateToken, // Ensure the user is authenticated
  upload.single('profileImage'), // Use multer to handle the file upload
  buyerProfileController.uploadBuyerProfileImage // Handle the upload logic
);



module.exports = router;