const mongoose = require('mongoose');

const returnSettingsSchema = new mongoose.Schema({
  _singleton: { type: String, default: 'global', unique: true },

  enabled: { type: Boolean, default: true },

  windowDays: { type: Number, default: 14, min: 1, max: 90 },

  shippingCostBearer: {
    type: String,
    enum: ['buyer', 'seller', 'platform'],
    default: 'buyer',
  },

  refundType: {
    type: String,
    enum: ['full', 'partial', 'admin_decides'],
    default: 'admin_decides',
  },

  maxRefundPercent: { type: Number, default: 100, min: 1, max: 100 },

  requireEvidence: { type: Boolean, default: true },

  autoApprove: { type: Boolean, default: false },

  allowedReasons: {
    type: [String],
    default: ['defective', 'wrong_item', 'not_as_described', 'damaged', 'other'],
  },
}, { timestamps: true });

module.exports = mongoose.model('ReturnSettings', returnSettingsSchema);
