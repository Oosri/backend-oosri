const mongoose = require('mongoose');

const buyerNotificationSchema = new mongoose.Schema({
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['order_placed', 'order_shipped', 'order_delivered', 'order_cancelled', 'return_update', 'system'],
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

buyerNotificationSchema.index({ buyerId: 1, createdAt: -1 });

module.exports = mongoose.model('BuyerNotification', buyerNotificationSchema);
