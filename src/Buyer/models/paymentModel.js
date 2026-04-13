
const mongoose = require('mongoose');
const PaymentSchema = new mongoose.Schema({
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        index: true
    },
    stripe_payment_intent_id: {
        type: String,
        index: true
    },
    stripe_charge_id: {
        type: String,
        index: true
    },
    buyer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Buyer',
        required: true
    },
    buyer_email: {
        type: String
    },
    gross_amount_cents: { type: Number },
    seller_amount_cents: { type: Number },
    platform_fee_cents: { type: Number },
    stripe_fee_cents: { type: Number, default: 0 },
    currency: { type: String },

    base_amount: { type: Number },
    base_currency: { type: String },
    fx_rate: { type: Number },

    seller_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        index: true
    },
    refund_amount_cents: {
        type: Number
    },
    failure_reason: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'succeeded', 'refunded', 'disputed', 'failed', 'requires_action'],
        default: 'pending'
    },
    recovery_required: {
        type: Boolean,
        default: false,
        index: true
    },
    recovery_state: {
        type: String,
        enum: ['none', 'pending_refund', 'refund_initiated', 'refunded', 'manual_intervention'],
        default: 'none'
    },
    recovery_last_error: {
        type: String
    },
    recovery_refund_id: {
        type: String,
        index: true
    },
    recovery_attempted_at: {
        type: Date
    },
    raw: { type: mongoose.Schema.Types.Mixed },

    // Store pending order info for inventory and audit
    pending_order_data: { type: mongoose.Schema.Types.Mixed }

}, { timestamps: true });

PaymentSchema.index({ stripe_payment_intent_id: 1, seller_id: 1 });
PaymentSchema.index({ buyer_id: 1, createdAt: -1 });
PaymentSchema.index({ recovery_required: 1, recovery_state: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);
