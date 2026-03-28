const express = require("express");
const router = express.Router();
const adminOrderController = require('../controllers/adminOrderController');
const joiSchemaValidation = require('../middleware/joiSchemaValidation');
const adminOrderSchema = require('../apiSchema/adminOrderSchema');
const accessControlValidation = require('../middleware/accessControlValidation');



router.get('/all',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  joiSchemaValidation.validateQueryParams(adminOrderSchema.retrieveAllOrderSchema),
  adminOrderController.retrieveAllOrders
);

router.get('/search',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  joiSchemaValidation.validateQueryParams(adminOrderSchema.searchOrderSchema),
  adminOrderController.searchOrders
);

router.get('/:id',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  adminOrderController.retrieveOrderById
);

router.patch('/:id/status',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  joiSchemaValidation.validateBody(adminOrderSchema.updateOrderStatusSchema),
  adminOrderController.updateOrderStatus
);



module.exports = router;
