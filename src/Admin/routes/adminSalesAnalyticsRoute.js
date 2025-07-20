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
   joiSchemaValidation.validateBody(adminSaleAnalyticsSchema.retrieveProductAnalyticsSchema),
  adminSalesAnalyticsController.retrieveProductSalesAnalytics
);


module.exports = router;
