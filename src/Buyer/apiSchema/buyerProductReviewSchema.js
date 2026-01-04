const Joi = require('@hapi/joi');

module.exports.addProductReviewSchema = Joi.object().keys({
  productId: Joi.string().required(),
  review: Joi.string().required(),
  productRating: Joi.number().required()
});






