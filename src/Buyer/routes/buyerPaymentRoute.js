const express = require('express');
const router = express.Router();
const buyerPaymentServiceController = require('../controllers/buyerPaymentController');
const buyerPaymentSchema = require('../apiSchema/buyerPaymentSchema');
const buyersPaymentController = require('../controllers/buyersPaymentController');
const accessControlValidation = require('../middlewares/accessControlValidation');
const joiSchemaValidation = require('../middlewares/joiSchemaValidation');
const { checkoutLimiter } = require('../../configs/rateLimiter');



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

// Stripe payment endpoints
router.post('/create-payment-intent',
  accessControlValidation.validateToken,
  checkoutLimiter,
  buyersPaymentController.createMultiVendorPaymentIntent
);
router.get(
  '/status/:paymentIntentId',
  accessControlValidation.validateToken,
  buyersPaymentController.getPaymentStatus
);
router.post('/webhooks/stripe', buyersPaymentController.handleStripeWebhook);

// Paystack payment endpoints (Nigerian buyers)
router.post(
  '/create-paystack-checkout',
  accessControlValidation.validateToken,
  checkoutLimiter,
  buyersPaymentController.createPaystackPaymentIntent
);
router.get(
  '/paystack/status/:reference',
  accessControlValidation.validateToken,
  buyersPaymentController.getPaystackPaymentStatus
);
router.post('/webhooks/paystack', buyersPaymentController.handlePaystackWebhook);

module.exports = router;
