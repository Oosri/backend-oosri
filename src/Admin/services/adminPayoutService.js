const Payout = require('../../Buyer/models/payoutModel');
const constants = require('../constants');

module.exports = {
  getPayouts: async ({ page = 1, limit = 20, status = '' }) => {
    const currentPage = Math.max(1, parseInt(page, 10));
    const pageSize    = Math.max(1, parseInt(limit, 10));
    const skip        = (currentPage - 1) * pageSize;

    const query = {};
    if (status && ['pending', 'paid', 'failed'].includes(status)) {
      query.status = status;
    }

    const [payouts, total] = await Promise.all([
      Payout.find(query).sort({ createdAt: -1 }).limit(pageSize).skip(skip),
      Payout.countDocuments(query),
    ]);

    return {
      payouts: payouts.map((p) => ({ ...p.toObject(), id: p._id })),
      pagination: { total, currentPage, totalPages: Math.ceil(total / pageSize) },
    };
  },

  approvePayout: async (payoutId) => {
    const payout = await Payout.findByIdAndUpdate(
      payoutId,
      { $set: { status: 'paid' } },
      { new: true }
    );
    if (!payout) throw new Error('Payout not found');
    return { ...payout.toObject(), id: payout._id };
  },

  rejectPayout: async (payoutId) => {
    const payout = await Payout.findByIdAndUpdate(
      payoutId,
      { $set: { status: 'failed' } },
      { new: true }
    );
    if (!payout) throw new Error('Payout not found');
    return { ...payout.toObject(), id: payout._id };
  },
};
