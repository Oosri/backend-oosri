const mongoose = require('mongoose');

const SellerLedgerSchema = new mongoose.Schema({
    seller_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
    payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    credit_usd_cents: { type: Number, default: 0 },
    debit_usd_cents: { type: Number, default: 0 },
    balance_after_cents: { type: Number },
    payout_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payout' }
}, { timestamps: true });

SellerLedgerSchema.index({ seller_id: 1, createdAt: -1 });
// Prevents double-crediting if webhook and verify fallback race on the same payment
SellerLedgerSchema.index({ payment_id: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('SellerLedger', SellerLedgerSchema);
