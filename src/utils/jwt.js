const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return process.env.JWT_SECRET;
};

const signJwt = (payload, options = {}) => {
  return jwt.sign(payload, getJwtSecret(), options);
};

const verifyJwt = (token) => {
  return jwt.verify(token, getJwtSecret());
};

module.exports = {
  getJwtSecret,
  signJwt,
  verifyJwt,
};
