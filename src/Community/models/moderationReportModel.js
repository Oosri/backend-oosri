const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const moderationReportSchema = new Schema(
  {
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['discussion', 'reply'],
      required: true,
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    reporterType: {
      type: String,
      enum: ['buyer', 'seller'],
      required: true,
    },
    reason: {
      type: String,
      enum: ['spam', 'harassment', 'inappropriate', 'misinformation', 'other'],
      required: true,
    },
    note: {
      type: String,
      maxlength: 500,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'actioned', 'dismissed'],
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

moderationReportSchema.index({ targetId: 1, reporterId: 1 }, { unique: true });
moderationReportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ModerationReport', moderationReportSchema);
