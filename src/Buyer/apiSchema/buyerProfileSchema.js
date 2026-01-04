const Joi = require('@hapi/joi');

module.exports.updateBuyerProfile = Joi.object().keys({
  email: Joi.string().optional(),
  fullName: Joi.string().optional(),
  phoneNumber: Joi.string().optional()
});

module.exports.addDeliveryAddress = Joi.object().keys({
  address: Joi.string().required(),
  postalCode: Joi.string().required(),
  cityName: Joi.string().required(),
  countryCode: Joi.string().required(),
  countryName: Joi.string().required()
});

module.exports.changeBuyerPassword = Joi.object().keys({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().required()
});

module.exports.updateDeliveryAddress = Joi.object().keys({
  address: Joi.string().optional(),
  postalCode: Joi.string().optional(),
  cityName: Joi.string().optional(),
  countryCode: Joi.string().optional(),
  countryName: Joi.string().optional()
});
