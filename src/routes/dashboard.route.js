const express = require('express');
const {
  dashboardSummary,
  dashboardSalesOverview
} = require('../controllers/dashboardController');
const { sellerAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/summary', sellerAuth, dashboardSummary);
router.get('/sales-overview', sellerAuth, dashboardSalesOverview);

module.exports = router;
