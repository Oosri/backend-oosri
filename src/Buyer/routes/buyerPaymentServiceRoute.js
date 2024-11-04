const express = require('express');
const router = express.Router();
const buyerPaymentServiceController = require('../../Buyer/controllers/buyerPaymentServiceController');
const accessControlValidation = require('../../Buyer/middlewares/accessControlValidation');

router.post('/initialize', 
    accessControlValidation.validateToken,
    buyerPaymentServiceController.initializeTransaction
);

router.get('/verify/:orderId', 
    accessControlValidation.validateToken,
    buyerPaymentServiceController.verifyPayment
);

module.exports = router;
