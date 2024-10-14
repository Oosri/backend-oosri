const Order = require('../Buyer/models/buyerOrderModel');

const dashboardSummary = async (req, res) => {
  const summary = await Order.aggregate([
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$totalAmount' },
        totalOrders: { $sum: 1 }
        // Calculate profit
      }
    }
  ]);
  res.json(summary[0]);
};

const dashboardSalesOverview = async (req, res) => {
  const { period } = req.query; // 'weekly', 'monthly', 'yearly'
  // Implement time-based aggregation
  const salesData = await Order.aggregate([
    // Group by time period and sum sales
  ]);
  res.json(salesData);
};

module.exports = { dashboardSummary, dashboardSalesOverview };
