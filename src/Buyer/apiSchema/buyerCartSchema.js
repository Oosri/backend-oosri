const Joi = require('@hapi/joi');

module.exports.createCartSchema = Joi.object().keys({
  items: Joi.array().items(
    Joi.object().keys({
      productId: Joi.string().hex().length(24).required(),
      quantity: Joi.number().required()
    })
  ).required(),
  cartKey: Joi.string().optional()
});

module.exports.updateCartSchema = Joi.object().keys({
  productId: Joi.string().hex().length(24).required(),
  quantityChange: Joi.number().required()
});
