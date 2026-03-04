const adminFxService = require('../services/adminFxService');
const constants = require('../constants');

/**
 * PUT /admin/fx/rate
 * Admin sets the NGN/USD exchange rate.
 * Body: { usdToNgnRate: 1350, note: "CBN rate March 2026" }
 */
module.exports.setRate = async (req, res) => {
    try {
        const { usdToNgnRate, note } = req.body;
        const adminId = req.user.id; // set by validateToken middleware

        const rateDoc = await adminFxService.setExchangeRate({
            usdToNgnRate,
            adminId,
            note,
        });

        return res.status(200).json({
            status: 200,
            message: `Exchange rate updated: $1 = ₦${usdToNgnRate.toLocaleString()}`,
            body: rateDoc,
        });
    } catch (error) {
        console.error('[AdminFxController] setRate error:', error.message);
        return res.status(500).json({
            status: 500,
            message: error.message || 'Failed to update exchange rate',
            body: {},
        });
    }
};

/**
 * GET /admin/fx/rate
 * Returns the current active exchange rate.
 */
module.exports.getRate = async (req, res) => {
    try {
        const rateDoc = await adminFxService.getCurrentRate();

        if (!rateDoc) {
            return res.status(404).json({
                status: 404,
                message: 'No exchange rate has been set yet. Use PUT /admin/fx/rate to set one.',
                body: null,
            });
        }

        return res.status(200).json({
            status: 200,
            message: 'Current exchange rate retrieved',
            body: rateDoc,
        });
    } catch (error) {
        console.error('[AdminFxController] getRate error:', error.message);
        return res.status(500).json({
            status: 500,
            message: error.message || 'Failed to retrieve exchange rate',
            body: {},
        });
    }
};
