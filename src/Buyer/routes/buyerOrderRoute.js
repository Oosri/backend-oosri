const express = require("express");
const router = express.Router();
const buyerOrderController = require('../../Buyer/controllers/buyerOrderController');
const joiSchemaValidation = require('../../Buyer/middlewares/joiSchemaValidation');
const buyerOrderSchema = require('../../Buyer/apiSchema/buyerOrderSchema');
const accessControlValidation = require('../../Buyer/middlewares/accessControlValidation');

router.post('/',
    accessControlValidation.validateToken,
    joiSchemaValidation.validateBody(buyerOrderSchema.createOrderSchema),
    buyerOrderController.createOrder
);

// router.get('/',
//   accessControlValidation.validateToken,
//   accessControlValidation.isAdmin,
//   joiSchemaValidation.validateQueryParams(orderSchema.retrieveUserOrderSchema), 
//   orderController.retrieveAllOrders
// );

router.get('/user',
  accessControlValidation.validateToken,
  buyerOrderController.retrieveBuyerOrders,
  joiSchemaValidation.validateQueryParams(buyerOrderSchema.retrieveUserOrderSchema), 
  
);

router.patch('/:orderId/cancel',
  accessControlValidation.validateToken,
  buyerOrderController.buyerCancelOrder
);

// router.delete('/:id',
//   accessControlValidation.validateToken,
//   accessControlValidation.isAdmin,
//   orderController.removeOrder
// );



module.exports = router;
