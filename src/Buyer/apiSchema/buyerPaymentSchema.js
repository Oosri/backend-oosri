const Joi = require('@hapi/joi');

module.exports.InitializePayment = Joi.object().keys({
  email: Joi.string().required(),
  amount: Joi.number().required(),
  orderId: Joi.string().hex().length(24).required()
});

module.exports.CreatePaymentIntent = Joi.object().keys({
  sellerId: Joi.string().hex().length(24).required(),
  buyerId: Joi.string().hex().length(24).required(),
  amount: Joi.number().integer().min(2).required(),
  currency: Joi.string().required()
});
