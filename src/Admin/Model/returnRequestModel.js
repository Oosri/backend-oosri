const mongoose = require('mongoose');

const RETURN_STATUSES = [
  'pending',
  'seller_approved',
  'seller_rejected',
  'escalated',
  'admin_approved',
  'admin_rejected',
  'refund_initiated',
  'refunded',
  'closed',
];

const RETURN_REASONS = [
  'defective',
  'wrong_item',
  'not_as_described',
  'damaged',
  'other',
];

const returnRequestSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true,
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer',
    required: true,
    index: true,
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    index: true,
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
  },
  reason: {
    type: String,
    required: true,
    enum: RETURN_REASONS,
  },
  reasonDetail: { type: String, maxlength: 1000 },

  evidenceUrls: { type: [String], default: [] },

  status: {
    type: String,
    enum: RETURN_STATUSES,
    default: 'pending',
    index: true,
  },

  refundType: { type: String, enum: ['full', 'partial'] },

  refundAmountCents: { type: Number, min: 0 },

  sellerNote: { type: String, maxlength: 1000 },

  adminNote: { type: String, maxlength: 1000 },

  gatewayRefundId: { type: String },

  timeline: [{
    status: { type: String },
    note: { type: String },
    actorType: { type: String, enum: ['buyer', 'seller', 'admin', 'system'] },
    actorId: { type: mongoose.Schema.Types.ObjectId },
    actorName: { type: String },
    timestamp: { type: Date, default: Date.now },
  }],

  resolvedAt: { type: Date },

}, { timestamps: true });

returnRequestSchema.index({ orderId: 1, buyerId: 1 }, { unique: true });
returnRequestSchema.index({ status: 1, createdAt: -1 });
returnRequestSchema.index({ buyerId: 1, createdAt: -1 });

module.exports = mongoose.model('ReturnRequest', returnRequestSchema);
module.exports.RETURN_STATUSES = RETURN_STATUSES;
module.exports.RETURN_REASONS = RETURN_REASONS;
