const Order = require('../Buyer/models/buyerOrderModel');
const Product = require('../models/productModel');


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
            $cond: { if: { $eq: ['$totalOrders', 0] }, then: 0, else: { $divide: ['$totalSales', '$totalOrders'] } }
          },
          payout: 0
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
            { $toString: { $cond: { if: { $lt: ['$_id.month', 10] }, then: { $concat: ['0', { $toString: '$_id.month' }] }, else: { $toString: '$_id.month' } } } }
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
      const dailyData = salesData.find((data) => data.period === today) || { totalSales: 0, orderCount: 0, period: today };

      return res.status(200).json({ status: 200, success: true, data: [dailyData] });
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

      return res.status(200).json({ status: 200, success: true, data: dailyData });
    }

    if (period === 'monthly') {
      const now = new Date();
      const months = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      }).reverse();

      const monthlyData = months.map((month) => {
        const existing = salesData.find((data) => data.period === month);
        return existing || { totalSales: 0, orderCount: 0, period: month };
      });

      return res.status(200).json({ status: 200, success: true, data: monthlyData });
    }

    if (period === 'yearly') {
      const now = new Date();
      const years = Array.from({ length: 5 }, (_, i) => (now.getFullYear() - i)).reverse();

      const yearlyData = years.map((year) => {
        const existing = salesData.find((data) => data.period === year.toString());
        return existing || { totalSales: 0, orderCount: 0, period: year.toString() };
      });

      return res.status(200).json({ status: 200, success: true, data: yearlyData });
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

module.exports = { dashboardSummary, dashboardSalesOverview };
