const Joi = require('@hapi/joi');

module.exports.InitializePayment = Joi.object().keys({
  email: Joi.string().required(),
  amount: Joi.number().required(),
  orderId: Joi.string().hex().length(24).required()
});
