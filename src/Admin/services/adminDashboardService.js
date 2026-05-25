const Order = require('../../Buyer/models/buyerOrderModel');
const constants = require('../constants');
const Seller = require('../../models/sellerModel');
const Buyer = require('../../Buyer/models/buyerAuthModel');
const { Product } = require('../../models/productModel');
const Payout = require('../../Buyer/models/payoutModel');
const SellerKyc = require('../Model/sellerKycModel');
const ReturnRequest = require('../Model/returnRequestModel');

module.exports = {
  getDashboardSummary: async () => {
    try {
      const completedStatus = 'Completed';

      const salesResult = await Order.aggregate([
        { $match: { orderStatus: completedStatus } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$totalAmount' },
            totalProductsSold: { $sum: { $sum: '$products.quantity' } }
          }
        }
      ]);

      const aggregatedData = salesResult.length > 0 ? salesResult[0] : { totalSales: 0, totalProductsSold: 0 };

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

      const summary = {
        totalSales: aggregatedData.totalSales,
        totalOrders,
        totalProductsSold: aggregatedData.totalProductsSold,
        totalSellers,
        totalBuyers,
        pendingProducts,
        pendingPayouts,
        pendingKyc,
        openReturns,
      };

      return summary;

    } catch (error) {
      console.error('Something went wrong: Service: getDashboardSummary', error);
      throw new Error(constants.adminDashboardMessage.SUMMARY_FETCH_ERROR);
    }
  },

  
  getDashboardSalesOverview: async (period = 'monthly') => {
    try {
      const completedStatus = 'Completed';
        
      let groupByFormat;
      let sortOrder = { _id: 1 };

      switch (period) {
        case 'daily':
          groupByFormat = '%Y-%m-%d';
          break;
        case 'weekly':
          groupByFormat = '%Y-%U';
          break;
        case 'annually':
          groupByFormat = '%Y';
          break;
        case 'monthly':
        default:
          groupByFormat = '%Y-%m';
          break;
      }

      const salesOverview = await Order.aggregate([
        {
          $match: {
            orderStatus: completedStatus
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: groupByFormat, date: '$orderDate' }
            },
            totalSales: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: sortOrder
        },
        {
            $project: {
                _id: 0,
                period: '$_id',
                totalSales: 1,
                orderCount: '$count'
            }
        }
      ]);

      return salesOverview;

    } catch (error) {
      console.error('Something went wrong: Service: getDashboardSalesOverview', error);
      throw new Error(constants.adminDashboardMessage.OVERVIEW_FETCH_ERROR);
    }
  }
};
