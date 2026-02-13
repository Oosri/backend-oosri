require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const dbConnect = require('./database');
const routes = require('../routes/index');
const cookieParser = require('cookie-parser');
const passport = require('passport');
require('./passport-config');

const app = express();

//CORS Configuration - Production Grade
const corsOptions = {
  origin: function (origin, callback) {
    // Using a Set is slightly more performant for lookups and avoids duplicates.
    const allowedOrigins = new Set([
      'https://oosri.com',
      'https://www.oosri.com',
      'https://www.seller.oosri.com',
      'https://www.admin.oosri.com',
      'https://seller.oosri.com',
      'https://admin.oosri.com',
      'https://oosri-seller.netlify.app',
      'https://admin-oosri.netlify.app',
      'https://buyer-oosri.netlify.app',
      'https://seller-oosri.netlify.app',
      'https://oosri-admin.netlify.app',
      'https://oosri-buyer.netlify.app',
      'https://seller-oosri-staging.netlify.app',
      'https://buyer-oosri-staging.netlify.app',
      'https://admin-oosri-staging.netlify.app',
      'https://oosriglobal-9895195.postman.co',
    ]);

    // Allow localhost in development OR if explicitly enabled in production
    // Set ALLOW_DEV_ORIGINS=true in Render to enable local testing against production
    const allowDevOrigins = process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_ORIGINS === 'true';

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    const isAllowed =
      allowedOrigins.has(origin) ||
      (allowDevOrigins && /^http:\/\/localhost:\d+$/.test(origin)) ||
      (allowDevOrigins && /^http:\/\/127\.0\.0\.1:\d+$/.test(origin));

    if (isAllowed) {
      return callback(null, true);
    }

    // Log blocked origin for debugging in production
    console.warn(`CORS blocked request from origin: ${origin}`);

    // Pass an error to the callback. This will be caught by your global error handler,
    // providing a clearer error response than the default browser CORS error.
    const error = new Error(`CORS policy violation: The origin '${origin}' is not allowed.`);
    error.status = 403;
    return callback(error);
  },

  // Allow credentials (cookies, authorization headers, TLS client certificates)
  credentials: true,

  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
  ],

  // Headers exposed to the client
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'Authorization',
    'X-Request-Id',
  ],

  // Cache preflight requests for 24 hours (86400 seconds)
  maxAge: 86400,

  // Pass the CORS preflight response to the next handler
  preflightContinue: false,

  // Provide a status code to use for successful OPTIONS requests
  optionsSuccessStatus: 204,
};


app.use(cors(corsOptions));

app.use(passport.initialize());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());
app.use(morgan('dev'));
app.use(helmet());
app.use('/api/v1', routes);
app.use('/media', express.static(path.join(__dirname, 'media')));
app.use(
  '/profile_pictures',
  express.static(path.join(__dirname, '../../public_html/profile_pictures'))
);

// Global Error Handler - Must be after all routes
app.use((err, req, res, next) => {
  // Log error for debugging
  console.error('Global Error Handler:', err.message);
  console.error('Stack:', err.stack);

  // Handle Multer-specific errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'File size exceeds the allowed limit (5MB)',
        field: err.field
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Too many files uploaded',
        field: err.field
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Unexpected file field',
        field: err.field
      });
    }
    // Generic Multer error
    return res.status(400).json({
      status: 400,
      success: false,
      message: err.message || 'File upload error',
      field: err.field
    });
  }

  // Handle file validation errors
  if (err.message && err.message.includes('file type')) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: err.message
    });
  }

  // Handle CORS errors
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      status: 403,
      success: false,
      message: 'CORS policy violation'
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 400,
      success: false,
      message: err.message,
      errors: err.errors
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 401,
      success: false,
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 401,
      success: false,
      message: 'Token expired'
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    status: statusCode,
    success: false,
    message: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

module.exports = app;
