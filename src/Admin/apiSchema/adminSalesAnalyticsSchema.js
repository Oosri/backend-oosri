const Joi = require('@hapi/joi');



module.exports.retrieveProductAnalyticsSchema = Joi.object().keys({
    dateFilter: Joi.string().valid('thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear', 'lastYear').optional(),
  });

  
module.exports.retrieveTopProductsAnalyticsSchema = Joi.object().keys({
    category: Joi.string().optional(),
    dateFilter: Joi.string().valid('thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear', 'lastYear').optional(),
  });