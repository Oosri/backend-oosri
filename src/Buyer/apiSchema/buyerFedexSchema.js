const Joi = require('@hapi/joi');


module.exports.getShippingFeeSchema = Joi.object().keys({
  origin: Joi.string().required(),
  destination: Joi.string().required(), 
  weight: Joi.number().required(), 
});

