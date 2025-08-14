const express = require('express');
const {
  dashboardSummary,
  dashboardSalesOverview,
  getSellerDashboardStats
} = require('../controllers/dashboardController');
const { sellerAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/summary', sellerAuth, dashboardSummary);
router.get('/sales-overview', sellerAuth, dashboardSalesOverview);
router.get('/stats', sellerAuth, getSellerDashboardStats);

module.exports = router;
