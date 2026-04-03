const Joi = require('@hapi/joi');

module.exports.updateAdminProfile = Joi.object().keys({
  email: Joi.string().optional(),
  fullName: Joi.string().optional(),
  phoneNumber: Joi.string().optional()

});

module.exports.changeAdminPassword = Joi.object().keys({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().required()
});


