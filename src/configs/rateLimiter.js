const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

const handler = (req, res) => {
  res.status(429).json({
    status: 429,
    success: false,
    message: 'Too many requests. Please wait and try again.',
  });
};

const defaults = {
  standardHeaders: true,
  legacyHeaders: false,
  handler,
};

// In development, limits are raised high so testing isn't blocked.
// Production values are the real security limits.
const otpLimiter        = rateLimit({ ...defaults, windowMs: 15 * 60 * 1000, max: isDev ? 100 : 5 });
const authLimiter       = rateLimit({ ...defaults, windowMs: 15 * 60 * 1000, max: isDev ? 100 : 10 });
const adminAuthLimiter  = rateLimit({ ...defaults, windowMs: 15 * 60 * 1000, max: isDev ? 100 : 5 });
const registrationLimiter = rateLimit({ ...defaults, windowMs: 60 * 60 * 1000, max: isDev ? 100 : 5 });
const resendOtpLimiter  = rateLimit({ ...defaults, windowMs: 15 * 60 * 1000, max: isDev ? 100 : 3 });
const passwordResetLimiter = rateLimit({ ...defaults, windowMs: 60 * 60 * 1000, max: isDev ? 100 : 5 });

module.exports = {
  otpLimiter,
  authLimiter,
  adminAuthLimiter,
  registrationLimiter,
  resendOtpLimiter,
  passwordResetLimiter,
};
