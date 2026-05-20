const express = require('express');
const adminSellerController = require('../controllers/adminSellerController');
const accessControlValidation = require('../middleware/accessControlValidation');
const { requirePermission } = accessControlValidation;
const validateObjectId = require('../../middlewares/validateObjectId');
const auditLog = require('../middlewares/auditLog');

const router = express.Router();

router.get(
  '/filter',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  requirePermission('sellers'),
  adminSellerController.filterSellers
);

router.get(
  '/',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  requirePermission('sellers'),
  adminSellerController.getAllSellers
);

router.get(
  '/:sellerId',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  requirePermission('sellers'),
  validateObjectId('sellerId'),
  adminSellerController.getSellerById
);

router.delete(
  '/:sellerId',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  requirePermission('sellers'),
  validateObjectId('sellerId'),
  auditLog('DELETE_SELLER', 'Seller', 'sellerId'),
  adminSellerController.deleteSeller
);

module.exports = router;
