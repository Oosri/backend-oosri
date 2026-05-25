const mongoose = require('mongoose');

const sellerNotificationSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['kyc_approved', 'kyc_rejected', 'new_order', 'product_approved', 'product_rejected', 'payout', 'return_request', 'new_review', 'system'],
  },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  isRead:  { type: Boolean, default: false, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
  toObject: {
    transform(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

sellerNotificationSchema.index({ sellerId: 1, createdAt: -1 });

module.exports = mongoose.model('SellerNotification', sellerNotificationSchema);
