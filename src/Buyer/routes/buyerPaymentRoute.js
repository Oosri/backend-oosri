const express = require('express');
const router = express.Router();
const buyerPaymentServiceController = require('../controllers/buyerPaymentController');
const buyerPaymentSchema = require('../apiSchema/buyerPaymentSchema');
const accessControlValidation = require('../middlewares/accessControlValidation');
const joiSchemaValidation = require('../middlewares/joiSchemaValidation');



router.post('/initialize', 
    accessControlValidation.validateToken,
    joiSchemaValidation.validateBody(buyerPaymentSchema.InitializePayment), 
    buyerPaymentServiceController.initializeTransaction
);

router.get(
  '/verify/:reference',
  accessControlValidation.validateToken,
  buyerPaymentServiceController.verifyPayment
);


module.exports = router;
