const express = require('express');
const adminBuyerController = require('../controllers/adminBuyerController');
const { validateToken, isAdmin } = require('../middleware/accessControlValidation');
const validateObjectId = require('../../middlewares/validateObjectId');

const router = express.Router();

router.get('/',
  validateToken, isAdmin,
  adminBuyerController.getAllBuyers
);

router.get('/:buyerId',
  validateToken, isAdmin,
  validateObjectId('buyerId'),
  adminBuyerController.getBuyerById
);

router.patch('/:buyerId/suspend',
  validateToken, isAdmin,
  validateObjectId('buyerId'),
  adminBuyerController.suspendBuyer
);

router.patch('/:buyerId/unsuspend',
  validateToken, isAdmin,
  validateObjectId('buyerId'),
  adminBuyerController.unsuspendBuyer
);

module.exports = router;
