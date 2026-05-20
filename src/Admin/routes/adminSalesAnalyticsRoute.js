const express = require('express');
const router = express.Router();
const adminSalesAnalyticsController = require('../controllers/adminSalesAnalyticsController');
const accessControlValidation = require('../middleware/accessControlValidation');
const { requirePermission } = accessControlValidation;
const joiSchemaValidation = require('../middleware/joiSchemaValidation');
const adminSaleAnalyticsSchema = require('../apiSchema/adminSalesAnalyticsSchema');

router.get(
  '/sales',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  requirePermission('analytics'),
  adminSalesAnalyticsController.retrieveOrderStat
);

router.get(
  '/products',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  requirePermission('analytics'),
  joiSchemaValidation.validateQueryParams(
    adminSaleAnalyticsSchema.retrieveProductAnalyticsSchema
  ),
  adminSalesAnalyticsController.retrieveProductSalesAnalytics
);
router.get(
  '/top-purchase-products',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  requirePermission('analytics'),
  joiSchemaValidation.validateQueryParams(
    adminSaleAnalyticsSchema.retrieveTopProductsAnalyticsSchema
  ),
  adminSalesAnalyticsController.retrieveTopMostPurchasedProducts
);

module.exports = router;
