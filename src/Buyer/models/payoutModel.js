const mongoose = require('mongoose');
const PayoutSchema = new mongoose.Schema({
    payout_reference: { type: String },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    total_usd_cents: { type: Number },
    total_ngn_kobo: { type: Number },
    initiated_by: { type: String },
    raw_response: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

PayoutSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payout', PayoutSchema);