const Order = require('../Buyer/models/buyerOrderModel');
const { Product } = require('../models/productModel');
const moment = require('moment');

const dashboardSummary = async (req, res) => {
  try {
    const startDate = new Date(
      req.query.startDate || new Date().setDate(new Date().getDate() - 30)
    );
    const endDate = new Date(req.query.endDate || Date.now());

    const sellerId = req.seller._id;

    const summary = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: startDate, $lte: endDate },
          'products.sellerId': sellerId
        }
      },
      {
        $unwind: '$products'
      },
      {
        $match: {
          'products.sellerId': sellerId
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$products.totalPrice' },
          totalOrders: { $sum: 1 },
          totalProductsSold: { $sum: '$products.quantity' }
        }
      },
      {
        $project: {
          _id: 0,
          totalSales: 1,
          totalOrders: 1,
          totalProductsSold: 1,
          averageOrderValue: {
            $cond: {
              if: { $eq: ['$totalOrders', 0] },
              then: 0,
              else: { $divide: ['$totalSales', '$totalOrders'] }
            }
          },
          payout: 1
        }
      }
    ]);

    const totalProducts = await Product.countDocuments({ seller: sellerId });

    const result = summary[0] || {
      totalSales: 0,
      totalOrders: 0,
      totalProductsSold: 0,
      averageOrderValue: 0,
      payout: 0
    };

    return res.status(200).json({
      status: 200,
      success: true,
      data: {
        ...result,
        totalProducts
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching dashboard summary',
      error: error.message
    });
  }
};

const dashboardSalesOverview = async (req, res) => {
  try {
    const startDate = new Date(
      req.query.startDate ||
        new Date().setFullYear(new Date().getFullYear() - 1)
    );
    const endDate = new Date(req.query.endDate || Date.now());
    const sellerId = req.seller._id;
    const period = req.query.period || 'monthly';

    let groupBy;
    let projectFormat;

    switch (period) {
      case 'daily':
        groupBy = {
          year: { $year: '$orderDate' },
          month: { $month: '$orderDate' },
          day: { $dayOfMonth: '$orderDate' }
        };
        projectFormat = {
          $dateToString: {
            format: '%Y-%m-%d',
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: '$_id.day'
              }
            }
          }
        };
        break;
      case 'weekly':
        groupBy = {
          year: { $year: '$orderDate' },
          week: { $week: '$orderDate' }
        };
        projectFormat = {
          $concat: [
            { $toString: '$_id.year' },
            '-W',
            { $toString: '$_id.week' }
          ]
        };
        break;
      case 'monthly':
        const last12MonthsStart = new Date();
        last12MonthsStart.setMonth(last12MonthsStart.getMonth() - 11);
        last12MonthsStart.setDate(1);

        groupBy = {
          year: { $year: '$orderDate' },
          month: { $month: '$orderDate' }
        };
        projectFormat = {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            {
              $toString: {
                $cond: {
                  if: { $lt: ['$_id.month', 10] },
                  then: { $concat: ['0', { $toString: '$_id.month' }] },
                  else: { $toString: '$_id.month' }
                }
              }
            }
          ]
        };
        break;
      case 'yearly':
        groupBy = {
          year: { $year: '$orderDate' }
        };
        projectFormat = {
          $toString: '$_id.year'
        };
        break;
      default:
        return res.status(400).json({ message: 'Invalid period specified' });
    }

    const salesData = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: startDate, $lte: endDate },
          'products.sellerId': sellerId
        }
      },
      {
        $unwind: '$products'
      },
      {
        $match: {
          'products.sellerId': sellerId
        }
      },
      {
        $group: {
          _id: groupBy,
          totalSales: { $sum: '$products.totalPrice' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          period: projectFormat,
          totalSales: 1,
          orderCount: 1
        }
      },
      {
        $sort: { period: 1 }
      }
    ]);

    if (period === 'daily') {
      const today = new Date().toISOString().split('T')[0];
      const dailyData = salesData.find((data) => data.period === today) || {
        totalSales: 0,
        orderCount: 0,
        period: today
      };

      return res
        .status(200)
        .json({ status: 200, success: true, data: [dailyData] });
    }

    if (period === 'weekly') {
      const now = new Date();
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(now.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      const dailyData = last7Days.map((day) => {
        const existing = salesData.find((data) => data.period === day);
        return existing || { totalSales: 0, orderCount: 0, period: day };
      });

      return res
        .status(200)
        .json({ status: 200, success: true, data: dailyData });
    }

    if (period === 'monthly') {
      const now = new Date();
      const months = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        return `${date.getFullYear()}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, '0')}`;
      }).reverse();

      const monthlyData = months.map((month) => {
        const existing = salesData.find((data) => data.period === month);
        return existing || { totalSales: 0, orderCount: 0, period: month };
      });

      return res
        .status(200)
        .json({ status: 200, success: true, data: monthlyData });
    }

    if (period === 'yearly') {
      const now = new Date();
      const years = Array.from(
        { length: 5 },
        (_, i) => now.getFullYear() - i
      ).reverse();

      const yearlyData = years.map((year) => {
        const existing = salesData.find(
          (data) => data.period === year.toString()
        );
        return (
          existing || { totalSales: 0, orderCount: 0, period: year.toString() }
        );
      });

      return res
        .status(200)
        .json({ status: 200, success: true, data: yearlyData });
    }

    return res
      .status(200)
      .json({ status: 200, success: true, data: salesData });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error fetching sales overview', error: error.message });
  }
};

const getSellerDashboardStats = async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const startOfYear = moment().startOf('year').toDate();
    const endOfYear = moment().endOf('year').toDate();

    const allOrders = await Order.find({
      'products.sellerId': sellerId,
      orderDate: { $gte: startOfYear, $lte: endOfYear }
    });

    if (!allOrders || allOrders.length === 0) {
      return res.status(200).json({
        status: 200,
        success: true,
        data: {
          totalEarnings: 0,
          totalOrders: 0,
          weeklyEarnings: 0,
          monthlyEarnings: {}
        }
      });
    }

    const monthNames = [
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec'
    ];

    let totalEarnings = 0.0;
    let weeklyEarnings = 0.0;
    const monthlyEarnings = {
      jan: 0.0,
      feb: 0.0,
      mar: 0.0,
      apr: 0.0,
      may: 0.0,
      jun: 0.0,
      jul: 0.0,
      aug: 0.0,
      sep: 0.0,
      oct: 0.0,
      nov: 0.0,
      dec: 0.0
    };

    const currentWeekStart = moment().startOf('week');
    const currentWeekEnd = moment().endOf('week');

    allOrders.forEach((order) => {
      order.products.forEach((product) => {
        if (product.sellerId.toString() === sellerId.toString()) {
          const orderDate = moment(order.orderDate);
          const deliveryFee = order.deliveryFee || 0;
          const orderTotal = +order.totalAmount + deliveryFee;

          totalEarnings += orderTotal;

          if (
            orderDate.isBetween(currentWeekStart, currentWeekEnd, null, '[]')
          ) {
            weeklyEarnings += orderTotal;
          }

          const monthIndex = orderDate.month();
          const monthName = monthNames[monthIndex];
          monthlyEarnings[monthName] += orderTotal;
        }
      });
    });

    res.status(200).json({
      status: 200,
      success: true,
      data: {
        totalEarnings,
        totalOrders: allOrders.length,
        weeklyEarnings,
        monthlyEarnings
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching seller dashboard stats',
      error: error.message
    });
  }
};

const productSalesAnalytics = async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const filters = req.query;

    let startDate = null;
    let endDate = null;

    switch (filters.dateFilter) {
      case 'thisWeek':
        startDate = moment().startOf('week');
        endDate = moment().endOf('week');
        break;
      case 'lastWeek':
        startDate = moment().subtract(1, 'weeks').startOf('week');
        endDate = moment().subtract(1, 'weeks').endOf('week');
        break;
      case 'thisMonth':
        startDate = moment().startOf('month');
        endDate = moment().endOf('month');
        break;
      case 'lastMonth':
        startDate = moment().subtract(1, 'months').startOf('month');
        endDate = moment().subtract(1, 'months').endOf('month');
        break;
      case 'thisYear':
        startDate = moment().startOf('year');
        endDate = moment().endOf('year');
        break;
      case 'lastYear':
        startDate = moment().subtract(1, 'years').startOf('year');
        endDate = moment().subtract(1, 'years').endOf('year');
        break;
    }

    const query = {
      'products.sellerId': sellerId
    };
    if (startDate && endDate) {
      query.orderDate = { $gte: startDate.toDate(), $lte: endDate.toDate() };
    }

    const allOrders = await Order.find(query)
      .populate({
        path: 'products.productId',
        select: 'productName images',
      });

    const productSalesMap = new Map();

    allOrders.forEach(order => {
      order.products.forEach(item => {
        if (item.sellerId.toString() === sellerId.toString()) {
          const { productId, price, totalPrice } = item;

          const quantity = item.quantity || Math.round(totalPrice / (price || 1));

          if (productId) {
            const productKey = productId._id?.toString();
            const current = productSalesMap.get(productKey) || {
              productId: productId._id,
              productName: productId.productName,
              productImage: productId.images,
              quantitySold: 0
            };
            current.quantitySold += quantity;
            productSalesMap.set(productKey, current);
          }
        }
      });
    });

    const productSales = Array.from(productSalesMap.values());

    const mostPurchasedProduct = productSales.sort((a, b) => b.quantitySold - a.quantitySold)[0] || null;
    const leastPurchasedProduct = productSales.sort((a, b) => a.quantitySold - b.quantitySold)[0] || null;

    res.status(200).json({
      status: 200,
      success: true,
      data: {
        mostPurchasedProduct,
        leastPurchasedProduct,
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching product sales analytics',
      error: error.message
    });
  }
};

module.exports = {
  dashboardSummary,
  dashboardSalesOverview,
  getSellerDashboardStats,
  productSalesAnalytics
};
