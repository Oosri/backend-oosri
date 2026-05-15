const express = require('express');
const router = express.Router();
const adminFxController = require('../controllers/adminFxController');
const joiSchemaValidation = require('../middleware/joiSchemaValidation');
const adminFxSchema = require('../apiSchema/adminFxSchema');
const accessControlValidation = require('../middleware/accessControlValidation');
const auditLog = require('../middlewares/auditLog');

/**
 * PUT /api/v1/admin/fx/rate
 * Set the admin-controlled NGN/USD exchange rate.
 * Body: { usdToNgnRate: 1350, note?: "CBN rate March 2026" }
 */
router.put(
    '/rate',
    accessControlValidation.validateToken,
    accessControlValidation.isAdmin,
    joiSchemaValidation.validateBody(adminFxSchema.setRateSchema),
    auditLog('UPDATE_FX_RATE', 'FxRate'),
    adminFxController.setRate
);

/**
 * GET /api/v1/admin/fx/rate
 * Get the current active exchange rate.
 */
router.get(
    '/rate',
    accessControlValidation.validateToken,
    accessControlValidation.isAdmin,
    adminFxController.getRate
);

module.exports = router;
