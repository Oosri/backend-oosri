const Joi = require('@hapi/joi');

module.exports.createBuyerSavedItemsSchema = Joi.object().keys({
  productId: Joi.string().hex().length(24).required(),
});


