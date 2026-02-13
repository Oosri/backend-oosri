require('dotenv').config();
const express = require('express');
const path = require('path');
  const cookieParser = require('cookie-parser');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const dbConnect = require('./database');
const routes = require('../routes/index');
const passport = require('passport');
require('./passport-config');

const app = express();

// Define allowed origins outside the request handler for performance
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

//CORS Configuration - Production Grade
const corsOptions = {
  origin: function (origin, callback) {
    const allowDevOrigins = process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_ORIGINS === 'true';

    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.has(origin) ||
      (allowDevOrigins && (origin.includes('localhost') || origin.includes('127.0.0.1')));

    if (isAllowed) {
      callback(null, true);
    } else {
      // Do NOT pass an error object here if you want a standard CORS rejection
      callback(null, false); 
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200 // Some older browsers choke on 204
};


app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

app.use(passport.initialize());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());
app.use(morgan('dev'));
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow cross-origin resource sharing for API
}));
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
