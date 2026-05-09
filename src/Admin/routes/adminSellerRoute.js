const express = require('express');
const adminSellerController = require('../controllers/adminSellerController');
const accessControlValidation = require('../middleware/accessControlValidation'); // Assuming this middleware exists
const validateObjectId = require('../../middlewares/validateObjectId');

const router = express.Router();

router.get(
  '/filter',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  adminSellerController.filterSellers
);

router.get(
  '/',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  adminSellerController.getAllSellers
);

router.get(
  '/:sellerId',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  validateObjectId('sellerId'),
  adminSellerController.getSellerById
);

router.delete(
  '/:sellerId',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  validateObjectId('sellerId'),
  adminSellerController.deleteSeller
);

module.exports = router;
