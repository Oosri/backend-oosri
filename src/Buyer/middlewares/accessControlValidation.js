const jwt = require('jsonwebtoken');
const constants = require('../constants');

module.exports.validateToken = (req, res, next) => {
  let response = { ...constants.defaultServerResponse };
  try {
    if (!req.headers.authorization) {
      throw new Error(constants.requestValidationMessage.TOKEN_MISSING);
    }
    const token = req.headers.authorization.split('Bearer')[1].trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
    //console.log("Decoded userId:", decoded.id);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('JWT verification error: ', error.message);
    response.message = error.message;
    response.status = 401;
    return res.status(response.status).send(response);
  }
};



module.exports.isValidPassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasDigits = /\d/.test(password);

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasDigits
  );
};



 module.exports.cartTokenValidation = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
    req.user = decoded; 
  }
  next();
};



