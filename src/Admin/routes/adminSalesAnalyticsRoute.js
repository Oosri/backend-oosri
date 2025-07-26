const express = require("express");
const router = express.Router();
const adminSalesAnalyticsController = require('../controllers/adminSalesAnalyticsController');
const accessControlValidation = require('../middleware/accessControlValidation');
const joiSchemaValidation = require('../middleware/joiSchemaValidation');
const adminSaleAnalyticsSchema = require('../apiSchema/adminSalesAnalyticsSchema');



router.get('/sales',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  adminSalesAnalyticsController.retrieveOrderStat
);


router.get('/products',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
   joiSchemaValidation.validateQueryParams(adminSaleAnalyticsSchema.retrieveProductAnalyticsSchema),
  adminSalesAnalyticsController.retrieveProductSalesAnalytics
);
router.get('/top-purchase-products',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  joiSchemaValidation.validateQueryParams(adminSaleAnalyticsSchema.retrieveTopProductsAnalyticsSchema),
  adminSalesAnalyticsController.retrieveTopMostPurchasedProducts
);


module.exports = router;
