const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1 
  }
});

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer',
    default: null 
  },
  cartKey: {
    type: String,
    default: null 
  },
  items: [cartItemSchema]
}, {
  timestamps: true,
  toObject: {
    transform: (doc, ret, options) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.createdAt;
      delete ret.updatedAt;
      delete ret.__v;
      return ret;
    }
  }
});

module.exports = mongoose.model('UserCart', cartSchema);
