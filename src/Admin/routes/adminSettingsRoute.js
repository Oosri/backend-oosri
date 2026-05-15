const express = require('express');
const adminSettingsController = require('../controllers/adminSettingsController');
const { validateToken, isAdmin } = require('../middleware/accessControlValidation');

const router = express.Router();

router.get('/',                 validateToken, isAdmin, adminSettingsController.getSettings);
router.put('/',                 validateToken, isAdmin, adminSettingsController.updateSettings);
router.post('/shipping/test',   validateToken, isAdmin, adminSettingsController.testShippingProvider);

module.exports = router;
