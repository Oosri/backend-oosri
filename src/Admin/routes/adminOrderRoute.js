const express = require("express");
const router = express.Router();
const adminOrderController = require('../controllers/adminOrderController');
const joiSchemaValidation = require('../middleware/joiSchemaValidation');
const adminOrderSchema = require('../apiSchema/adminOrderSchema');
const accessControlValidation = require('../middleware/accessControlValidation');
const { requirePermission } = accessControlValidation;
const validateObjectId = require('../../middlewares/validateObjectId');
const auditLog = require('../middlewares/auditLog');



router.get('/all',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  requirePermission('orders'),
  joiSchemaValidation.validateQueryParams(adminOrderSchema.retrieveAllOrderSchema),
  adminOrderController.retrieveAllOrders
);

router.get('/search',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  requirePermission('orders'),
  joiSchemaValidation.validateQueryParams(adminOrderSchema.searchOrderSchema),
  adminOrderController.searchOrders
);

router.get('/:id',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  requirePermission('orders'),
  validateObjectId('id'),
  adminOrderController.retrieveOrderById
);

router.patch('/:id/status',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  requirePermission('orders'),
  validateObjectId('id'),
  joiSchemaValidation.validateBody(adminOrderSchema.updateOrderStatusSchema),
  auditLog('UPDATE_ORDER_STATUS', 'Order', 'id'),
  adminOrderController.updateOrderStatus
);



module.exports = router;
