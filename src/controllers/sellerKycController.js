const SellerKyc = require('../Admin/Model/sellerKycModel');
const { uploadSellerDocument } = require('../utils/cloudinary');
const constants = require('../Admin/constants');

module.exports.submitKyc = async (req, res) => {
  try {
    const seller = req.seller;
    const files = req.files || {};

    const hasFile = files['governmentId']?.[0] || files['proofOfAddress']?.[0] || files['businessCertificate']?.[0];
    if (!hasFile) {
      return res.status(400).json({ status: 400, success: false, message: constants.kycMessage.NO_DOCUMENTS });
    }

    let existing = await SellerKyc.findOne({ sellerId: seller._id });

    const uploads = {};
    if (files['governmentId']?.[0]) {
      uploads['documents.governmentId'] = await uploadSellerDocument(files['governmentId'][0], 'gov_id', seller._id.toString());
    }
    if (files['proofOfAddress']?.[0]) {
      uploads['documents.proofOfAddress'] = await uploadSellerDocument(files['proofOfAddress'][0], 'proof_addr', seller._id.toString());
    }
    if (files['businessCertificate']?.[0]) {
      uploads['documents.businessCertificate'] = await uploadSellerDocument(files['businessCertificate'][0], 'biz_cert', seller._id.toString());
    }

    if (existing) {
      if (existing.status === 'approved') {
        return res.status(409).json({ status: 409, success: false, message: constants.kycMessage.KYC_ALREADY_APPROVED });
      }
      Object.assign(existing, uploads);
      if (Object.keys(uploads).length) {
        for (const [key, val] of Object.entries(uploads)) {
          const field = key.replace('documents.', '');
          existing.documents[field] = val;
        }
      }
      existing.status = 'pending';
      existing.submittedAt = new Date();
      existing.rejectionReason = null;
      existing.reviewedAt = null;
      existing.reviewedBy = null;
      existing.timeline.push({ status: 'pending', actorId: seller._id, actorRole: 'seller', note: 'Documents resubmitted' });
      await existing.save();

      return res.status(200).json({ status: 200, success: true, message: constants.kycMessage.KYC_UPDATED, data: existing.toObject() });
    }

    const docFields = {};
    for (const [key, val] of Object.entries(uploads)) {
      const field = key.replace('documents.', '');
      docFields[field] = val;
    }

    const kyc = new SellerKyc({
      sellerId: seller._id,
      documents: docFields,
      timeline: [{ status: 'pending', actorId: seller._id, actorRole: 'seller', note: 'Initial submission' }]
    });
    await kyc.save();

    return res.status(201).json({ status: 201, success: true, message: constants.kycMessage.KYC_SUBMITTED, data: kyc.toObject() });
  } catch (error) {
    console.error('submitKyc error:', error);
    return res.status(500).json({ status: 500, success: false, message: error.message });
  }
};

module.exports.getMyKyc = async (req, res) => {
  try {
    const seller = req.seller;
    const kyc = await SellerKyc.findOne({ sellerId: seller._id });
    return res.status(200).json({ status: 200, success: true, data: kyc ? kyc.toObject() : null });
  } catch (error) {
    console.error('getMyKyc error:', error);
    return res.status(500).json({ status: 500, success: false, message: error.message });
  }
};
