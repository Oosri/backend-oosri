const Joi = require('@hapi/joi');



module.exports.retrieveAllOrderSchema = Joi.object().keys({
    skip: Joi.string().optional(),
    limit: Joi.string().optional(),
    customerName: Joi.string().optional(),
    sellerName: Joi.string().optional(),
    orderStatus: Joi.string().optional()
  });
