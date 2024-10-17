const express = require('express');
const {
  dashboardSummary,
  dashboardSalesOverview
} = require('../controllers/dashboardController');

const router = express.Router();

router.get('/summary', dashboardSummary);
router.get('/sales-overview', dashboardSalesOverview);

module.exports = router;
