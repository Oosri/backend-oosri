const PayoutSchema = new Schema({
    payout_reference: { type: String },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    total_usd_cents: { type: Number },
    total_ngn_kobo: { type: Number },
    initiated_by: { type: String },
    raw_response: { type: Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Payout', PayoutSchema);