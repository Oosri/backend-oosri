const express = require('express');
const adminProductController = require('../controllers/adminProductController');
const accessControlValidation = require('../middleware/accessControlValidation');

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
  adminProductController.approveProduct
);
router.get(
  '/:productId',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  adminProductController.getProductById
);
router.delete(
  '/:productId',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  adminProductController.deleteProduct
);
router.patch(
  '/:productId/visibility',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  adminProductController.toggleProductVisibility
);

module.exports = router;
