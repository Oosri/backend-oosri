const express = require('express');
const adminBuyerController = require('../controllers/adminBuyerController');
const { validateToken, isAdmin, requirePermission } = require('../middleware/accessControlValidation');
const validateObjectId = require('../../middlewares/validateObjectId');
const auditLog = require('../middlewares/auditLog');

const router = express.Router();

router.get('/',
  validateToken, isAdmin, requirePermission('buyers'),
  adminBuyerController.getAllBuyers
);

router.get('/:buyerId',
  validateToken, isAdmin, requirePermission('buyers'),
  validateObjectId('buyerId'),
  adminBuyerController.getBuyerById
);

router.patch('/:buyerId/suspend',
  validateToken, isAdmin, requirePermission('buyers'),
  validateObjectId('buyerId'),
  auditLog('SUSPEND_BUYER', 'Buyer', 'buyerId'),
  adminBuyerController.suspendBuyer
);

router.patch('/:buyerId/unsuspend',
  validateToken, isAdmin, requirePermission('buyers'),
  validateObjectId('buyerId'),
  auditLog('UNSUSPEND_BUYER', 'Buyer', 'buyerId'),
  adminBuyerController.unsuspendBuyer
);

module.exports = router;
