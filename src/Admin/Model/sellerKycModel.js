const mongoose = require('mongoose');

const KYC_STATUSES = ['pending', 'approved', 'rejected'];

const kycTimelineSchema = new mongoose.Schema({
  status: { type: String, enum: KYC_STATUSES, required: true },
  note: { type: String, default: '' },
  actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
  actorRole: { type: String, enum: ['seller', 'admin'], default: 'seller' },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const sellerKycSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: KYC_STATUSES,
    default: 'pending',
    index: true
  },
  documents: {
    governmentId: { type: String, default: null },
    proofOfAddress: { type: String, default: null },
    businessCertificate: { type: String, default: null }
  },
  rejectionReason: { type: String, default: null },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date, default: null },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  timeline: [kycTimelineSchema]
}, {
  timestamps: true,
  toObject: {
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

sellerKycSchema.index({ status: 1, submittedAt: -1 });

module.exports = mongoose.model('SellerKyc', sellerKycSchema);
module.exports.KYC_STATUSES = KYC_STATUSES;
