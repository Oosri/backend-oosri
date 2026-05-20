const express = require('express');
const router = express.Router();
const adminReturnController = require('../controllers/adminReturnController');
const { validateToken, isAdmin, isSuperAdmin, requirePermission } = require('../middleware/accessControlValidation');

// Settings — super admin only
router.get('/settings',
  validateToken,
  isAdmin,
  isSuperAdmin,
  adminReturnController.getSettings
);

router.put('/settings',
  validateToken,
  isAdmin,
  isSuperAdmin,
  adminReturnController.updateSettings
);

// Return requests — requires 'returns' permission
router.get('/',
  validateToken,
  isAdmin,
  requirePermission('returns'),
  adminReturnController.getAllReturns
);

router.get('/:id',
  validateToken,
  isAdmin,
  requirePermission('returns'),
  adminReturnController.getReturnById
);

router.patch('/:id/approve',
  validateToken,
  isAdmin,
  requirePermission('returns'),
  adminReturnController.approveReturn
);

router.patch('/:id/reject',
  validateToken,
  isAdmin,
  requirePermission('returns'),
  adminReturnController.rejectReturn
);

router.patch('/:id/refund',
  validateToken,
  isAdmin,
  requirePermission('returns'),
  adminReturnController.triggerRefund
);

router.patch('/:id/close',
  validateToken,
  isAdmin,
  requirePermission('returns'),
  adminReturnController.closeReturn
);

module.exports = router;
