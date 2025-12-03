const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const dbConnect = require('./database');
const routes = require('../routes/index');
const cookieParser = require('cookie-parser');
const passport = require('passport');
require('./passport-config');

const app = express();


// CORS Configuration - Production Grade
const corsOptions = {
  origin: function (origin, callback) {
    // Define allowed origins based on environment
    const allowedOrigins = [
      'https://oosri.com',
      'https://www.oosri.com',
      'https://seller.oosri.com',
      'https://admin.oosri.com',
    ];

    // In development, allow localhost and local network IPs
    if (process.env.NODE_ENV !== 'production') {
      allowedOrigins.push(
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:5173', // Vite default
        'http://localhost:5174',
        'http://localhost:5175',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175'
      );
    }

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
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

dotenv.config();
dbConnect();


app.use(passport.initialize());
app.use(express.json());
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


module.exports = app;
