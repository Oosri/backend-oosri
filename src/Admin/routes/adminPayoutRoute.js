const express = require('express');
const adminPayoutController = require('../controllers/adminPayoutController');
const { validateToken, isAdmin } = require('../middleware/accessControlValidation');
const validateObjectId = require('../../middlewares/validateObjectId');
const auditLog = require('../middlewares/auditLog');

const router = express.Router();

router.get('/',
  validateToken, isAdmin,
  adminPayoutController.getPayouts
);

router.patch('/:payoutId/approve',
  validateToken, isAdmin,
  validateObjectId('payoutId'),
  auditLog('APPROVE_PAYOUT', 'Payout', 'payoutId'),
  adminPayoutController.approvePayout
);

router.patch('/:payoutId/reject',
  validateToken, isAdmin,
  validateObjectId('payoutId'),
  auditLog('REJECT_PAYOUT', 'Payout', 'payoutId'),
  adminPayoutController.rejectPayout
);

module.exports = router;
