const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const reactionSchema = new Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userType: { type: String, enum: ['buyer', 'seller'], required: true },
    emoji: { type: String, required: true, maxlength: 10 },
  },
  { _id: false }
);

const replySchema = new Schema(
  {
    discussionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discussion',
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    authorType: {
      type: String,
      enum: ['buyer', 'seller'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    isSellerResponse: {
      type: Boolean,
      default: false,
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    reactions: [reactionSchema],
    status: {
      type: String,
      enum: ['active', 'hidden', 'deleted'],
      default: 'active',
    },
  },
  { timestamps: true }
);

replySchema.index({ discussionId: 1, createdAt: 1 });

module.exports = mongoose.model('Reply', replySchema);
