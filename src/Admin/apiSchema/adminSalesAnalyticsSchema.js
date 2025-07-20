const Joi = require('@hapi/joi');



module.exports.retrieveProductAnalyticsSchema = Joi.object().keys({
    dateFilter: Joi.string().valid('thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear', 'lastYear').optional(),
  });

  