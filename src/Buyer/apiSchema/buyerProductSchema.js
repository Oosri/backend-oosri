const Joi = require('@hapi/joi');


module.exports.retrieveAllProductSchema = Joi.object({
  color: Joi.string().optional(),
  category: Joi.string().optional(),
  subCategory: Joi.string().optional(),
  minPrice: Joi.number().optional(),
  maxPrice: Joi.number().optional(),
  productName: Joi.string().optional(),
  skip: Joi.string().optional(),
  limit: Joi.string().optional()
});



module.exports.searchProductSchema = Joi.object({
  searchTerm: Joi.string().required(),
  skip: Joi.string().optional(),
  limit: Joi.string().optional()
});
