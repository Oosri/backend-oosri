const Joi = require('@hapi/joi');

const VALID_PERMISSIONS = [
  'orders', 'products', 'sellers', 'buyers',
  'analytics', 'categories', 'attributes',
  'payouts', 'fx', 'settings',
];

module.exports.createAdmin = Joi.object().keys({
  email: Joi.string().email().required(),
  fullName: Joi.string().required(),
  phoneNumber: Joi.string().required(),
  userRoles: Joi.string().valid('admin', 'super_admin').default('admin'),
  permissions: Joi.array().items(Joi.string().valid(...VALID_PERMISSIONS)).default([]),
});

module.exports.resendOtpSchema = Joi.object().keys({
  email: Joi.string().email().required()
});

module.exports.adminLogin = Joi.object().keys({
  email: Joi.string().required(),
  password: Joi.string().required()
});


module.exports.refreshToken = Joi.object().keys({
  refreshToken: Joi.string().required()
});


module.exports.requestResetPasswordSchema = Joi.object().keys({
  email: Joi.string().email().required()
});

module.exports.validatePasswordTokenSchema = Joi.object().keys({
  otp: Joi.string().required(),
  email: Joi.string().required(),
});

module.exports.confirmResetPasswordSchema = Joi.object().keys({
  otp: Joi.string().required(),
  email: Joi.string().required(),
  newPassword: Joi.string().required(),
  confirmPassword: Joi.string().required(),

});

module.exports.verify2FA = Joi.object().keys({
  email: Joi.string().required(),
  otp: Joi.string().required()
});

