const express = require('express');
const router = express.Router();
const adminProfileController = require('../controllers/adminProfileController');
const joiSchemaValidation = require('../middleware/joiSchemaValidation');
const adminProfileSchema = require('../apiSchema/adminProfileSchema');
const accessControlValidation = require('../middleware/accessControlValidation');
const upload = require('../middleware/fileUploadValidation');


router.put('/update-profile',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  joiSchemaValidation.validateBody(adminProfileSchema.updateAdminProfile),
  adminProfileController.updateAdminProfile
);

router.post('/change-password', 
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  joiSchemaValidation.validateBody(adminProfileSchema.changeAdminPassword),
  adminProfileController.changePassword
);


router.put('/update-email',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  accessControlValidation.isSuperAdmin,
  adminProfileController.updateAdminEmail
);

router.post('/profile-image',
  accessControlValidation.validateToken, 
  accessControlValidation.isAdmin,
  upload.single('profileImage'), 
  adminProfileController.uploadAdminProfileImage 
);



module.exports = router;