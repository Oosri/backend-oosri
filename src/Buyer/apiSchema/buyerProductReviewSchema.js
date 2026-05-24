const Joi = require('@hapi/joi');

module.exports.addProductReviewSchema = Joi.object().keys({
  productId: Joi.string().required(),
  review: Joi.string().required(),
  productRating: Joi.number().required()
});

module.exports.updateProductReviewSchema = Joi.object().keys({
  review: Joi.string().required(),
  productRating: Joi.number().min(1).max(5).required()
});






