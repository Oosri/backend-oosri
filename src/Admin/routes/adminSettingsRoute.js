const express = require('express');
const adminSettingsController = require('../controllers/adminSettingsController');
const { validateToken, isAdmin, requirePermission } = require('../middleware/accessControlValidation');
const auditLog = require('../middlewares/auditLog');

const router = express.Router();

router.get('/',               validateToken, isAdmin, requirePermission('settings'), adminSettingsController.getSettings);
router.put('/',               validateToken, isAdmin, requirePermission('settings'), auditLog('UPDATE_SETTINGS', 'Settings'), adminSettingsController.updateSettings);
router.post('/shipping/test', validateToken, isAdmin, requirePermission('settings'), adminSettingsController.testShippingProvider);

module.exports = router;
