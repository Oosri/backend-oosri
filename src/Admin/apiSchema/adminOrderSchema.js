const Joi = require('@hapi/joi');



module.exports.retrieveAllOrderSchema = Joi.object().keys({
    skip: Joi.string().optional(),
    limit: Joi.string().optional(),
    customerName: Joi.string().optional(),
    sellerName: Joi.string().optional(),
    orderStatus: Joi.string().optional(),
    dateFilter: Joi.string().valid('thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear', 'lastYear').optional(),
    fromDate: Joi.string().optional(),
    toDate: Joi.string().optional()
  });

  module.exports.searchOrderSchema = Joi.object().keys({
    searchTerm: Joi.string().required(),
    skip: Joi.string().optional(),
    limit: Joi.string().optional()
  });
