const express = require('express');
const adminDashboardController = require('../controllers/adminDashboardController');
const accessControlValidation = require('../middleware/accessControlValidation');

const router = express.Router();

router.get(
  '/summary',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  adminDashboardController.getDashboardSummary
);

router.get(
  '/sales-overview',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  adminDashboardController.getDashboardSalesOverview
);


module.exports = router;
