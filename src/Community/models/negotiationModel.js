const mongoose = require('mongoose');
const crypto = require('crypto');

const Schema = mongoose.Schema;

const messageSchema = new Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    senderType: { type: String, enum: ['buyer', 'seller'], required: true },
    type: {
      type: String,
      enum: ['offer', 'counter', 'accept', 'reject', 'message'],
      required: true,
    },
    price: { type: Number, default: null },
    quantity: { type: Number, default: null },
    note: { type: String, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

const negotiationSchema = new Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
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
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['discount', 'bundle', 'wholesale', 'shipping'],
      required: true,
    },
    originalPrice: {
      type: Number,
      required: true,
    },
    requestedPrice: {
      type: Number,
      required: true,
    },
    counterPrice: {
      type: Number,
      default: null,
    },
    finalPrice: {
      type: Number,
      default: null,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: ['pending', 'countered', 'accepted', 'rejected', 'expired', 'completed'],
      default: 'pending',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    checkoutToken: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },
    messages: [messageSchema],
    buyerNote: {
      type: String,
      maxlength: 500,
      default: '',
    },
    isViewedBySeller: {
      type: Boolean,
      default: false,
    },
    isViewedByBuyer: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

negotiationSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
negotiationSchema.index({ buyerId: 1, status: 1, createdAt: -1 });
negotiationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

negotiationSchema.methods.generateCheckoutToken = function () {
  this.checkoutToken = crypto.randomBytes(32).toString('hex');
  return this.checkoutToken;
};

module.exports = mongoose.model('Negotiation', negotiationSchema);
