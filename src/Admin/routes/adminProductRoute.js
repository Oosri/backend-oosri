const express = require('express');
const adminProductController = require('../controllers/adminProductController');
const accessControlValidation = require('../middleware/accessControlValidation');
const validateObjectId = require('../../middlewares/validateObjectId');

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
  adminProductController.deleteProduct
);
router.patch(
  '/:productId/visibility',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  validateObjectId('productId'),
  adminProductController.toggleProductVisibility
);

module.exports = router;
