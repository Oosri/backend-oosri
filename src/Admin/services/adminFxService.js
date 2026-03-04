const FxRate = require('../../models/fxRateModel');
const redis = require('../../configs/redis');

const REDIS_KEY = 'fx_rate_ngn_usd_admin';
const FX_TTL_MS = Number(process.env.FX_TTL_MS ?? 10 * 60 * 1000); // 10 minutes default

/**
 * Admin FX Service
 * Manages the admin-controlled NGN/USD exchange rate.
 */
module.exports = {

    /**
     * Set (or update) the active exchange rate.
     * Upserts a single active document and immediately invalidates the Redis cache
     * so the new rate takes effect on the very next request.
     *
     * @param {Object} params
     * @param {number} params.usdToNgnRate - Whole number. How many NGN = 1 USD. e.g. 1350
     * @param {string} params.adminId      - Admin's Mongoose ObjectId (from JWT)
     * @param {string} [params.note]       - Optional human-readable note
     * @returns {Object} The saved FxRate document
     */
    setExchangeRate: async ({ usdToNgnRate, adminId, note = '' }) => {
        // Compute the inverse for display/confirmation purposes only.
        // The actual conversion uses 1 / usdToNgnRate at runtime.
        const ngnToUsdRate = Number((1 / usdToNgnRate).toFixed(8));

        // Upsert: find the single active document and update it, or create it fresh.
        const rateDoc = await FxRate.findOneAndUpdate(
            { isActive: true },
            {
                usdToNgnRate,
                setByAdminId: adminId,
                note,
                isActive: true,
            },
            {
                new: true,        // return the updated document
                upsert: true,     // create if it doesn't exist
                setDefaultsOnInsert: true,
                runValidators: true,
            }
        );

        // Immediately bust the Redis cache so consumers pick up the new rate.
        try {
            await redis.del(REDIS_KEY);
            console.log(`[AdminFX] Redis cache invalidated after rate update to ${usdToNgnRate}`);
        } catch (redisErr) {
            // Non-fatal — the next Redis read will be a DB miss and will re-populate correctly.
            console.error('[AdminFX] Failed to invalidate Redis cache:', redisErr.message);
        }

        console.log(`[AdminFX] Rate updated by admin ${adminId}: $1 = ₦${usdToNgnRate} (ngnToUsd: ${ngnToUsdRate})`);

        return {
            _id: rateDoc._id,
            usdToNgnRate: rateDoc.usdToNgnRate,
            ngnToUsdRate,
            effectiveRate: `$1 = ₦${rateDoc.usdToNgnRate.toLocaleString()}`,
            note: rateDoc.note,
            setByAdminId: rateDoc.setByAdminId,
            updatedAt: rateDoc.updatedAt,
            createdAt: rateDoc.createdAt,
        };
    },

    /**
     * Get the current active exchange rate.
     * @returns {Object|null} Rate document with human-readable fields, or null if not set.
     */
    getCurrentRate: async () => {
        const rateDoc = await FxRate.findOne({ isActive: true })
            .populate('setByAdminId', 'email')
            .lean();

        if (!rateDoc) {
            return null;
        }

        const ngnToUsdRate = Number((1 / rateDoc.usdToNgnRate).toFixed(8));

        return {
            _id: rateDoc._id,
            usdToNgnRate: rateDoc.usdToNgnRate,
            ngnToUsdRate,
            effectiveRate: `$1 = ₦${rateDoc.usdToNgnRate.toLocaleString()}`,
            note: rateDoc.note,
            setBy: rateDoc.setByAdminId?.email || 'Unknown',
            updatedAt: rateDoc.updatedAt,
            createdAt: rateDoc.createdAt,
        };
    },
};
