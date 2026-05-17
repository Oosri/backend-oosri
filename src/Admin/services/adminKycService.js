const mongoose = require('mongoose');
const SellerKyc = require('../Model/sellerKycModel');
const Seller = require('../../models/sellerModel');
const sendEmail = require('../../utils/emailService');
const constants = require('../constants');
const SellerNotification = require('../../models/sellerNotificationModel');
const createNotificationService = require('../../utils/notificationService');
const escapeRegex = require('../../utils/escapeRegex');
const sellerNotifSvc = createNotificationService(SellerNotification, 'sellerId');

module.exports.getAllKyc = async ({ page = 1, limit = 10, status, search }) => {
  const query = {};
  if (status) query.status = status;

  if (search) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    const sellers = await Seller.find({
      $or: [{ firstName: regex }, { lastName: regex }, { email: regex }]
    }).select('_id');
    query.sellerId = { $in: sellers.map(s => s._id) };
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [records, total] = await Promise.all([
    SellerKyc.find(query)
      .populate('sellerId', 'firstName lastName email businessType sellerStatus')
      .populate('reviewedBy', 'fullName email')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    SellerKyc.countDocuments(query),
  ]);

  return {
    records: records.map(r => r.toObject()),
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)) || 1,
  };
};

module.exports.getKycById = async (kycId) => {
  if (!mongoose.Types.ObjectId.isValid(kycId)) {
    throw new Error(constants.databaseMessage.INVALID_ID);
  }
  const kyc = await SellerKyc.findById(kycId)
    .populate('sellerId', 'firstName lastName email phone_number businessType sellerStatus profilePicture')
    .populate('reviewedBy', 'fullName email');
  if (!kyc) throw new Error(constants.kycMessage.KYC_NOT_FOUND);
  return kyc.toObject();
};

module.exports.approveKyc = async (kycId, adminId) => {
  if (!mongoose.Types.ObjectId.isValid(kycId)) {
    throw new Error(constants.databaseMessage.INVALID_ID);
  }
  const kyc = await SellerKyc.findById(kycId).populate('sellerId', 'firstName lastName email sellerStatus');
  if (!kyc) throw new Error(constants.kycMessage.KYC_NOT_FOUND);
  if (kyc.status === 'approved') throw new Error(constants.kycMessage.KYC_ALREADY_APPROVED);

  kyc.status = 'approved';
  kyc.reviewedAt = new Date();
  kyc.reviewedBy = adminId;
  kyc.rejectionReason = null;
  kyc.timeline.push({ status: 'approved', actorId: adminId, actorRole: 'admin', note: 'Documents verified and approved' });
  await kyc.save();

  await Seller.findByIdAndUpdate(kyc.sellerId._id, {
    isVerified: true,
    sellerStatus: 'Verified'
  });

  setImmediate(async () => {
    try {
      const seller = kyc.sellerId;
      const sellerName = `${seller.firstName} ${seller.lastName}`;
      await Promise.all([
        sendEmail.kycApproved(seller.email, sellerName),
        sellerNotifSvc.create({
          ownerId: seller._id,
          type: 'kyc_approved',
          title: 'KYC Verified ✓',
          message: 'Your identity documents have been reviewed and approved. Your account is now fully verified.',
        }),
      ]);
    } catch (e) {
      console.error('KYC approved notification failed:', e);
    }
  });

  return kyc.toObject();
};

module.exports.rejectKyc = async (kycId, adminId, reason) => {
  if (!mongoose.Types.ObjectId.isValid(kycId)) {
    throw new Error(constants.databaseMessage.INVALID_ID);
  }
  const kyc = await SellerKyc.findById(kycId).populate('sellerId', 'firstName lastName email');
  if (!kyc) throw new Error(constants.kycMessage.KYC_NOT_FOUND);
  if (kyc.status === 'approved') throw new Error(constants.kycMessage.KYC_ALREADY_APPROVED);

  kyc.status = 'rejected';
  kyc.reviewedAt = new Date();
  kyc.reviewedBy = adminId;
  kyc.rejectionReason = reason || null;
  kyc.timeline.push({
    status: 'rejected',
    actorId: adminId,
    actorRole: 'admin',
    note: reason || 'Documents rejected'
  });
  await kyc.save();

  await Seller.findByIdAndUpdate(kyc.sellerId._id, {
    isVerified: false,
    sellerStatus: 'Unverified'
  });

  setImmediate(async () => {
    try {
      const seller = kyc.sellerId;
      const sellerName = `${seller.firstName} ${seller.lastName}`;
      await Promise.all([
        sendEmail.kycRejected(seller.email, sellerName, reason),
        sellerNotifSvc.create({
          ownerId: seller._id,
          type: 'kyc_rejected',
          title: 'KYC Review Update',
          message: reason
            ? `Your KYC was not approved: ${reason}. Please resubmit your documents.`
            : 'Your KYC submission was not approved. Please review and resubmit your documents.',
        }),
      ]);
    } catch (e) {
      console.error('KYC rejected notification failed:', e);
    }
  });

  return kyc.toObject();
};
