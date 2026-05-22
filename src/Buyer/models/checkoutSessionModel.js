const mongoose = require('mongoose');

const checkoutSessionSchema = new mongoose.Schema(
  {
    buyer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Buyer',
      required: true,
      index: true,
    },
    request_hash: {
      type: String,
      required: true,
    },
    stripe_payment_intent_id: {
      type: String,
      index: true,
    },
    paystack_reference: {
      type: String,
      index: true,
      sparse: true,
    },
    gateway: {
      type: String,
      enum: ['stripe', 'paystack'],
      default: 'stripe',
      index: true,
    },
    client_secret: {
      type: String,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'expired'],
      default: 'active',
      index: true,
    },
    response_payload: {
      type: mongoose.Schema.Types.Mixed,
    },
    expires_at: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

checkoutSessionSchema.index(
  { buyer_id: 1, request_hash: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
  }
);

module.exports = mongoose.model('CheckoutSession', checkoutSessionSchema);
