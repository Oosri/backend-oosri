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
            _id: null,
            totalGMV:          { $sum: { $ifNull: ['$totalAmount', 0] } },
            totalProductsSold: { $sum: '$quantitySold' },
          },
        },
      ]);

      const agg = salesResult[0] || { totalGMV: 0, totalProductsSold: 0 };

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
        totalSales: parseFloat((agg.totalGMV * PLATFORM_FEE_RATE).toFixed(2)),
        totalGMV: parseFloat(agg.totalGMV.toFixed(2)),
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

      switch (period) {
        case 'daily':   groupByFormat = '%Y-%m-%d'; break;
        case 'weekly':  groupByFormat = '%Y-%U';    break;
        case 'annually': groupByFormat = '%Y';       break;
        case 'monthly':
        default:        groupByFormat = '%Y-%m';    break;
      }

      const salesOverview = await Order.aggregate([
        { $match: { orderStatus: COMPLETED } },
        {
          $group: {
            _id: { $dateToString: { format: groupByFormat, date: '$orderDate' } },
            totalGMV:   { $sum: '$totalAmount' },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            period: '$_id',
            totalSales: { $multiply: ['$totalGMV', PLATFORM_FEE_RATE] },
            totalGMV: 1,
            orderCount: 1,
          },
        },
      ]);

      return salesOverview;

    } catch (error) {
      console.error('Something went wrong: Service: getDashboardSalesOverview', error);
      throw new Error(constants.adminDashboardMessage.OVERVIEW_FETCH_ERROR);
    }
  },
};
