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

const discussionSchema = new Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
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
    type: {
      type: String,
      enum: ['question', 'discussion', 'review_comment'],
      default: 'discussion',
    },
    isPinned: {
      type: Boolean,
      default: false,
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
    replyCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'hidden', 'deleted'],
      default: 'active',
    },
    moderationFlag: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

discussionSchema.index({ productId: 1, createdAt: -1 });
discussionSchema.index({ productId: 1, isPinned: -1, createdAt: -1 });
discussionSchema.index({ authorId: 1, authorType: 1 });

module.exports = mongoose.model('Discussion', discussionSchema);
