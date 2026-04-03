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

router.get('/delivery-addresses',
  accessControlValidation.validateToken,
  buyerProfileController.getDeliveryAddresses
);

router.post('/delivery-addresses',
  accessControlValidation.validateToken,
  joiSchemaValidation.validateBody(buyerProfileSchema.addDeliveryAddress),
  buyerProfileController.addDeliveryAddress
);

router.delete('/delivery-addresses/:addressId',
  accessControlValidation.validateToken,
  buyerProfileController.removeDeliveryAddress
);

router.put('/delivery-addresses/:addressId',
  accessControlValidation.validateToken,
  joiSchemaValidation.validateBody(buyerProfileSchema.updateDeliveryAddress),
  buyerProfileController.updateDeliveryAddress
);



module.exports = router;