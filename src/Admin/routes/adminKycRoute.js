const express = require('express');
const { validateToken, isAdmin, requirePermission } = require('../middleware/accessControlValidation');
const adminKycController = require('../controllers/adminKycController');

const router = express.Router();

router.use(validateToken, isAdmin, requirePermission('kyc'));

router.get('/', adminKycController.getAllKyc);
router.get('/:kycId', adminKycController.getKycById);
router.post('/:kycId/approve', adminKycController.approveKyc);
router.post('/:kycId/reject', adminKycController.rejectKyc);

module.exports = router;
