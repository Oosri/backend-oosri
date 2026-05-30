const Joi = require('@hapi/joi');

module.exports.registerBuyer = Joi.object().keys({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(8).required(),
  fullName: Joi.string().min(2).max(100).pattern(/^[\p{L}\s'\-\.]+$/u).required(),
  gender: Joi.string().valid('Male', 'Female', 'Other').required(),
  phoneNumber: Joi.string().pattern(/^\+?[0-9\s\-().]{7,20}$/).required()
});

module.exports.confirmOtp = Joi.object().keys({
  email: Joi.string().required(),
  otp: Joi.string().required()
});

module.exports.resendOtpSchema = Joi.object().keys({
  email: Joi.string().email().required()
});

module.exports.buyerLogin = Joi.object().keys({
  email: Joi.string().trim().email().required(),
  password: Joi.string().trim().min(1).required()
});


module.exports.refreshToken = Joi.object().keys({
  refreshToken: Joi.string().optional()
});


module.exports.requestResetPasswordSchema = Joi.object().keys({
  email: Joi.string().email().required()
});

module.exports.confirmResetPasswordSchema = Joi.object().keys({
  otp: Joi.string().required(),
  email: Joi.string().required(),
  newPassword: Joi.string().required(),
  confirmPassword: Joi.string().required(),

});
module.exports.googleLogin = Joi.object().keys({
  accessToken: Joi.string(),
  code: Joi.string(),
}).xor('accessToken', 'code');
