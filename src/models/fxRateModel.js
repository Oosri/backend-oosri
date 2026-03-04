const mongoose = require('mongoose');

/**
 * FxRate Model
 *
 * Stores the admin-controlled NGN/USD exchange rate.
 * Only ONE document is ever active at a time.
 * Admin enters the rate as a whole number representing how many NGN = 1 USD.
 * e.g. usdToNgnRate: 1350  =>  $1 = ₦1,350
 *
 * The inverse (ngnToUsdRate = 1 / usdToNgnRate) is what all conversion
 * functions use internally.
 */
const fxRateSchema = new mongoose.Schema(
    {
        // How many NGN equals 1 USD. Admin-friendly number. e.g. 1350
        usdToNgnRate: {
            type: Number,
            required: true,
            min: 100,
            max: 10000,
        },

        // Which admin set this rate (audit trail)
        setByAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            required: true,
        },

        // Optional human-readable note for context
        note: {
            type: String,
            maxlength: 200,
            default: '',
        },

        // Only one document is active at a time
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Index to make the active-rate lookup as fast as possible
fxRateSchema.index({ isActive: 1 });

module.exports = mongoose.model('FxRate', fxRateSchema);
