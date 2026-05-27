const Buyer = require('../../Buyer/models/buyerAuthModel');
const constants = require('../constants');
const mongoDbDataFormat = require('../helper/dbHelper');

module.exports = {
  getAllBuyers: async ({ page = 1, limit = 20, searchTerm = '' }) => {
    const currentPage = Math.max(1, parseInt(page, 10));
    const pageSize    = Math.max(1, parseInt(limit, 10));
    const skip        = (currentPage - 1) * pageSize;

    const query = {};
    if (searchTerm.trim()) {
      const regex = new RegExp(searchTerm.trim(), 'i');
      query.$or = [{ fullName: regex }, { email: regex }, { phoneNumber: regex }];
    }

    const [buyers, total] = await Promise.all([
      Buyer.find(query).select('-password -refreshTokenHash').sort({ createdAt: -1 }).limit(pageSize).skip(skip),
      Buyer.countDocuments(query),
    ]);

    return {
      buyers: buyers.map((b) => {
        const formatted = mongoDbDataFormat.formatMongoData(b);
        const addr = b.deliveryAddresses?.find((a) => a.isDefault) || b.deliveryAddresses?.[0];
        formatted.country = addr?.countryName || null;
        return formatted;
      }),
      pagination: { total, currentPage, totalPages: Math.ceil(total / pageSize) },
    };
  },

  getBuyerById: async (buyerId) => {
    mongoDbDataFormat.checkObjectId(buyerId);
    const buyer = await Buyer.findById(buyerId).select('-password -refreshTokenHash');
    if (!buyer) throw new Error('Buyer not found');
    return mongoDbDataFormat.formatMongoData(buyer);
  },

  suspendBuyer: async (buyerId, reason) => {
    mongoDbDataFormat.checkObjectId(buyerId);
    const buyer = await Buyer.findByIdAndUpdate(
      buyerId,
      { $set: { isSuspended: true, suspensionReason: reason || 'Admin action' } },
      { new: true }
    ).select('-password -refreshTokenHash');
    if (!buyer) throw new Error('Buyer not found');
    return mongoDbDataFormat.formatMongoData(buyer);
  },

  unsuspendBuyer: async (buyerId) => {
    mongoDbDataFormat.checkObjectId(buyerId);
    const buyer = await Buyer.findByIdAndUpdate(
      buyerId,
      { $unset: { isSuspended: '', suspensionReason: '' } },
      { new: true }
    ).select('-password -refreshTokenHash');
    if (!buyer) throw new Error('Buyer not found');
    return mongoDbDataFormat.formatMongoData(buyer);
  },
};
