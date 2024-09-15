const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const dbConnect = require('./database');
const routes = require('../routes/index');
const passport = require('passport');
require('./passport-config');

dotenv.config();
dbConnect();

const app = express();
app.use(passport.initialize());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan('dev'));
app.use(helmet());
app.use('/api/v1', routes);
app.use('/media', express.static(path.join(__dirname, 'media')));


module.exports = app;