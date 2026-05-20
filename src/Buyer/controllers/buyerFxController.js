const adminControlledFxService = require('../Service/adminControlledFxService');

/**
 * GET /buyer/fx/rate
 * Public endpoint — returns the current admin-controlled USD→NGN rate.
 * No auth required (prices are visible to everyone).
 */
module.exports.getFxRate = async (req, res) => {
    try {
        const ngnToUsdRate = await adminControlledFxService.getFxRateNGNtoUSD();
        const usdToNgnRate = Math.round(1 / ngnToUsdRate);

        return res.status(200).json({
            success: true,
            body: {
                usdToNgnRate,
                ngnToUsdRate: Number(ngnToUsdRate.toFixed(8)),
                updatedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('[BuyerFX] Error fetching FX rate:', error.message);
        return res.status(200).json({
            success: true,
            body: {
                usdToNgnRate: 1550,
                ngnToUsdRate: Number((1 / 1550).toFixed(8)),
                updatedAt: new Date().toISOString(),
                fallback: true,
            },
        });
    }
};
