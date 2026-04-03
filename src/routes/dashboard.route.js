const express = require('express');
const {
  dashboardSummary,
  dashboardSalesOverview,
  getSellerDashboardStats,
  productSalesAnalytics
} = require('../controllers/dashboardController');
const { sellerAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/summary', sellerAuth, dashboardSummary);
router.get('/sales-overview', sellerAuth, dashboardSalesOverview);
router.get('/stats', sellerAuth, getSellerDashboardStats);
router.get('/product-sales-analytics', sellerAuth, productSalesAnalytics);

module.exports = router;
