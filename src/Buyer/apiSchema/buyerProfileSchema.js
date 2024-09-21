const Joi = require('@hapi/joi');

module.exports.updateBuyerProfile = Joi.object().keys({
  email: Joi.string().optional(),
  fullName: Joi.string().optional(),
  phoneNumber: Joi.string().optional()

});

module.exports.changeBuyerPassword = Joi.object().keys({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().required()
});


