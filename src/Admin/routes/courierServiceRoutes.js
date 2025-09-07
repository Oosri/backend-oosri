const express = require('express');
const couriersServiceController = require('../controllers/CourierServiceController');
const accessControlValidation = require('../middleware/accessControlValidation'); 
const joiSchemaValidation = require('../middleware/joiSchemaValidation');
const courierServiceSchema = require('../apiSchema/courierServiceSchema');
const router = express.Router();
const upload = require('../middleware/fileUploadValidation');

router.post('/',
//   accessControlValidation.validateToken,
//   accessControlValidation.isAdmin,
 upload.single('image'),
 joiSchemaValidation.validateBody(courierServiceSchema.createCourierServiceSchema),
  couriersServiceController.createCourierService
);

router.get('/',

  couriersServiceController.retrieveAllCourierServices
);



module.exports = router;
