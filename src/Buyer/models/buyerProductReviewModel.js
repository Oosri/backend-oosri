const mongoose = require('mongoose');

const buyerProductReviewSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  review: String,
  reviewer: String,
  reviewerEmail: String,
  productRating: Number,
  reviewerImage: String,
  reviewDate: String,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer',
    required: true
  }
},
{ 
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

module.exports = mongoose.model('ProductReview', buyerProductReviewSchema);
