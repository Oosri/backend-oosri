const rateLimit = require('express-rate-limit');

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

// OTP verification — 5 attempts per 15 min (4-digit codes are brute-forceable)
const otpLimiter = rateLimit({ ...defaults, windowMs: 15 * 60 * 1000, max: 5 });

// Login / sign-in — 10 attempts per 15 min
const authLimiter = rateLimit({ ...defaults, windowMs: 15 * 60 * 1000, max: 10 });

// Admin login — stricter: 5 attempts per 15 min
const adminAuthLimiter = rateLimit({ ...defaults, windowMs: 15 * 60 * 1000, max: 5 });

// Registration — 5 accounts per hour per IP
const registrationLimiter = rateLimit({ ...defaults, windowMs: 60 * 60 * 1000, max: 5 });

// Resend OTP — 3 resends per 15 min
const resendOtpLimiter = rateLimit({ ...defaults, windowMs: 15 * 60 * 1000, max: 3 });

// Password reset requests — 5 per hour
const passwordResetLimiter = rateLimit({ ...defaults, windowMs: 60 * 60 * 1000, max: 5 });

module.exports = {
  otpLimiter,
  authLimiter,
  adminAuthLimiter,
  registrationLimiter,
  resendOtpLimiter,
  passwordResetLimiter,
};
