const express = require('express');
const adminProductController = require('../controllers/adminProductController');
const accessControlValidation = require('../middleware/accessControlValidation');
const validateObjectId = require('../../middlewares/validateObjectId');
const auditLog = require('../middlewares/auditLog');

const router = express.Router();

router.get(
  '/filter',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  adminProductController.filterProducts
);
router.get(
  '/',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  adminProductController.getAllProducts
);
router.post(
  '/:productId',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  validateObjectId('productId'),
  auditLog('APPROVE_PRODUCT', 'Product', 'productId'),
  adminProductController.approveProduct
);
router.get(
  '/:productId',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  validateObjectId('productId'),
  adminProductController.getProductById
);
router.delete(
  '/:productId',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  validateObjectId('productId'),
  auditLog('DELETE_PRODUCT', 'Product', 'productId'),
  adminProductController.deleteProduct
);
router.patch(
  '/:productId/visibility',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  validateObjectId('productId'),
  auditLog('TOGGLE_PRODUCT_VISIBILITY', 'Product', 'productId'),
  adminProductController.toggleProductVisibility
);

module.exports = router;
