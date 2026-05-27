const Order = require('../../Buyer/models/buyerOrderModel');
const constants = require('../constants');
const Seller = require('../../models/sellerModel');
const Buyer = require('../../Buyer/models/buyerAuthModel');
const { Product } = require('../../models/productModel');
const Payout = require('../../Buyer/models/payoutModel');
const SellerKyc = require('../Model/sellerKycModel');
const ReturnRequest = require('../Model/returnRequestModel');

const PLATFORM_FEE_RATE = parseFloat(process.env.PLATFORM_FEE_PERCENT || '15') / 100;
const COMPLETED = 'completed';

module.exports = {
  getDashboardSummary: async () => {
    try {
      const salesResult = await Order.aggregate([
        { $match: { orderStatus: COMPLETED } },
        {
          $addFields: {
            quantitySold: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$products', []] },
                  as: 'p',
                  in: { $ifNull: ['$$p.quantity', 0] },
                },
              },
            },
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$currencyCode', 'NGN'] },
            totalGMV:          { $sum: { $ifNull: ['$totalAmount', 0] } },
            totalProductsSold: { $sum: '$quantitySold' },
          },
        },
      ]);

      let totalGMVUSD = 0, totalGMVNGN = 0, totalProductsSold = 0;
      for (const row of salesResult) {
        if (row._id === 'USD') totalGMVUSD = row.totalGMV;
        else totalGMVNGN += row.totalGMV;
        totalProductsSold += row.totalProductsSold;
      }

      const agg = {
        totalGMVUSD,
        totalGMVNGN,
        totalProductsSold,
      };

      const [
        totalOrders,
        totalSellers,
        totalBuyers,
        pendingProducts,
        pendingPayouts,
        pendingKyc,
        openReturns,
      ] = await Promise.all([
        Order.countDocuments(),
        Seller.countDocuments(),
        Buyer.countDocuments(),
        Product.countDocuments({ productStatus: 'pending' }),
        Payout.countDocuments({ status: 'pending' }),
        SellerKyc.countDocuments({ status: 'pending' }),
        ReturnRequest.countDocuments({ status: 'pending' }),
      ]);

      return {
        totalSalesUSD:  parseFloat((agg.totalGMVUSD * PLATFORM_FEE_RATE).toFixed(2)),
        totalSalesNGN:  parseFloat((agg.totalGMVNGN * PLATFORM_FEE_RATE).toFixed(2)),
        totalGMVUSD:    parseFloat(agg.totalGMVUSD.toFixed(2)),
        totalGMVNGN:    parseFloat(agg.totalGMVNGN.toFixed(2)),
        totalOrders,
        totalProductsSold: agg.totalProductsSold,
        totalSellers,
        totalBuyers,
        pendingProducts,
        pendingPayouts,
        pendingKyc,
        openReturns,
      };

    } catch (error) {
      console.error('Something went wrong: Service: getDashboardSummary', error);
      throw new Error(constants.adminDashboardMessage.SUMMARY_FETCH_ERROR);
    }
  },


  getDashboardSalesOverview: async (period = 'monthly') => {
    try {
      let groupByFormat;
      const matchStage = { orderStatus: COMPLETED };

      switch (period) {
        case 'daily':    groupByFormat = '%Y-%m-%d'; break;
        case 'weekly':   groupByFormat = '%Y-%U';    break;
        case 'annually': {
          // Show month-by-month breakdown for the current calendar year
          groupByFormat = '%Y-%m';
          const now = new Date();
          matchStage.orderDate = {
            $gte: new Date(now.getFullYear(), 0, 1),
            $lte: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
          };
          break;
        }
        case 'monthly':
        default:         groupByFormat = '%Y-%m';    break;
      }

      // DEBUG — remove after diagnosis
      const completedCount = await Order.countDocuments({ orderStatus: COMPLETED });
      console.log('[Dashboard Overview] period:', period, '| completed orders total:', completedCount, '| matchStage:', JSON.stringify(matchStage));

      const rawOverview = await Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { $dateToString: { format: groupByFormat, date: '$orderDate' } },
            totalGMVUSD: {
              $sum: {
                $cond: [{ $eq: ['$currencyCode', 'USD'] }, { $ifNull: ['$totalAmount', 0] }, 0],
              },
            },
            totalGMVNGN: {
              $sum: {
                $cond: [
                  { $in: ['$currencyCode', ['NGN', null]] },
                  { $ifNull: ['$totalAmount', 0] },
                  0,
                ],
              },
            },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, period: '$_id', totalGMVUSD: 1, totalGMVNGN: 1, orderCount: 1 } },
      ]);

      console.log('[Dashboard Overview] rawOverview:', JSON.stringify(rawOverview));

      const salesOverview = rawOverview
        .filter((item) => item.period != null)
        .map((item) => ({
          period:        item.period,
          totalGMVUSD:   item.totalGMVUSD,
          totalGMVNGN:   item.totalGMVNGN,
          totalSalesUSD: parseFloat((item.totalGMVUSD * PLATFORM_FEE_RATE).toFixed(2)),
          totalSalesNGN: parseFloat((item.totalGMVNGN * PLATFORM_FEE_RATE).toFixed(2)),
          orderCount:    item.orderCount,
        }));

      return salesOverview;

    } catch (error) {
      console.error('Something went wrong: Service: getDashboardSalesOverview', error);
      throw new Error(constants.adminDashboardMessage.OVERVIEW_FETCH_ERROR);
    }
  },
};
