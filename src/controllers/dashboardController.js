const Order = require('../Buyer/models/buyerOrderModel');

const dashboardSummary = async (req, res) => {
  try {
    const startDate = new Date(
      req.query.startDate || new Date().setDate(new Date().getDate() - 30)
    );
    const endDate = new Date(req.query.endDate || Date.now());

    const summary = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' },
          totalOrders: { $count: {} },
          totalProducts: { $sum: { $size: '$products' } }
        }
      },
      {
        $project: {
          _id: 0,
          totalSales: 1,
          totalOrders: 1,
          totalProducts: 1,
          averageOrderValue: { $divide: ['$totalSales', '$totalOrders'] }
        }
      }
    ]);

    const profitMargin = 0.2; // Calculate profit (assuming a fixed profit margin of 20% for simplicity)
    const result = summary[0] || {
      totalSales: 0,
      totalOrders: 0,
      totalProducts: 0,
      averageOrderValue: 0
    };
    result.profit = result.totalSales * profitMargin;

    return res.status(200).json({ status: 200, success: true, data: result });
  } catch (error) {
    res
      .status(500)
      .json({
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
    const period = req.query.period || 'monthly';

    let groupBy;
    let projectFormat;

    switch (period) {
      case 'weekly':
        groupBy = {
          year: { $year: '$date' },
          week: { $week: '$date' }
        };
        projectFormat = {
          $dateToString: {
            format: '%Y-W%V',
            date: {
              $dateFromParts: {
                isoWeekYear: '$_id.year',
                isoWeek: '$_id.week',
                isoDayOfWeek: 1
              }
            }
          }
        };
        break;
      case 'monthly':
        groupBy = {
          year: { $year: '$date' },
          month: { $month: '$date' }
        };
        projectFormat = {
          $dateToString: {
            format: '%Y-%m',
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month'
              }
            }
          }
        };
        break;
      case 'yearly':
        groupBy = {
          year: { $year: '$date' }
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
          orderDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: groupBy,
          totalSales: { $sum: '$totalAmount' },
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
