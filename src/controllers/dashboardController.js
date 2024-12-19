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
          totalOrders: { $sum: 1 },
          totalProducts: { $sum: { $size: '$products' } }
        }
      },
      {
        $project: {
          _id: 0,
          totalSales: 1,
          totalOrders: 1,
          totalProducts: 1,
          averageOrderValue: { $divide: ['$totalSales', '$totalOrders'] },
          payout: {
            $multiply: ['$totalSales', 0.85] // Calculate payout (85% of total sales)
          }
        }
      }
    ]);

    const result = summary[0] || {
      totalSales: 0,
      totalOrders: 0,
      totalProducts: 0,
      averageOrderValue: 0,
      payout: 0
    };

    return res.status(200).json({ status: 200, success: true, data: result });
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
          year: { $year: '$orderDate' },
          month: { $month: '$orderDate' }
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
