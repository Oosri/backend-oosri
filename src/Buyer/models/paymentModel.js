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
    gross_amount_cents: {
        type: Number
    },
    currency: {
        type: String
    },
    platform_fee_cents: {
        type: Number
    },
    stripe_fee_cents: {
        type: Number,
        default: 0
    },
    seller_amount_cents: {
        type: Number
    },
    seller_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller', index: true
    },
    status: {
        type: String,
        enum: ['pending', 'succeeded', 'refunded', 'disputed', 'failed'],
        default: 'pending'
    },
    raw: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);