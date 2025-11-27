const SellerLedgerSchema = new Schema({
    seller_id: { type: Schema.Types.ObjectId, ref: 'Seller' },
    payment_id: { type: Schema.Types.ObjectId, ref: 'Payment' },
    credit_usd_cents: { type: Number, default: 0 },
    debit_usd_cents: { type: Number, default: 0 },
    balance_after_cents: { type: Number },
    payout_id: { type: Schema.Types.ObjectId, ref: 'Payout' }
}, { timestamps: true });

module.exports = mongoose.model('SellerLedger', SellerLedgerSchema);