const express = require("express");
const router = express.Router();
const buyerOrderController = require('../../Buyer/controllers/buyerOrderController');
const joiSchemaValidation = require('../../Buyer/middlewares/joiSchemaValidation');
const buyerOrderSchema = require('../../Buyer/apiSchema/buyerOrderSchema');
const accessControlValidation = require('../../Buyer/middlewares/accessControlValidation');
const validateObjectId = require('../../middlewares/validateObjectId');

// Create order
router.post('/',
  accessControlValidation.validateToken,
  joiSchemaValidation.validateBody(buyerOrderSchema.createOrderSchema),
  buyerOrderController.createOrder
);

// Retrieve orders by user
router.get('/user',
  accessControlValidation.validateToken,
  joiSchemaValidation.validateQueryParams(buyerOrderSchema.retrieveOrderSchema), 
  buyerOrderController.retrieveBuyerOrders
);

// Retrieve orders by seller
router.get('/seller',
  accessControlValidation.validateSellerToken,
  joiSchemaValidation.validateQueryParams(buyerOrderSchema.retrieveOrderSchema), 
  buyerOrderController.retrieveSellerOrders
);

router.get('/delivery-addresses',
  accessControlValidation.validateToken,
  buyerOrderController.retrieveUserDeliveryAddresses
);

// OrderById
router.get('/user/:id',
  accessControlValidation.validateToken,
  validateObjectId('id'),
  buyerOrderController.retrieveOrderById
);

// Cancel order
router.patch('/:orderId/cancel',
  accessControlValidation.validateToken,
  validateObjectId('orderId'),
  buyerOrderController.buyerCancelOrder
);

module.exports = router;
