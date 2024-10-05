const Joi = require('@hapi/joi');

module.exports.contactUs = Joi.object().keys({
  email: Joi.string().required(),
  fullName: Joi.string().required(),
  message: Joi.string().required()
});

