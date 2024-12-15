const jwt = require('jsonwebtoken');
const constants = require('../constants');

module.exports.validateToken = (req, res, next) => {
  let response = { ...constants.customServerResponse };
  try {
    if (!req.headers.authorization) {
      throw new Error(constants.requestValidationMessage.TOKEN_MISSING);
    }
    const token = req.headers.authorization.split('Bearer')[1].trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    console.log('JWT verification error: ', error.message);
    response.message = error.message;
    response.status = 401;
    return res.status(response.status).send(response);
  }
};

 module.exports.validateSellerToken = (req, res, next) => {
  const authHeader = req.header('Authorization'); 
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access Denied: No token provided or invalid format' });
  }

  const token = authHeader.split(' ')[1]; 

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      req.sellerId = decoded.sellerId;

      next();
  } catch (error) {
      return res.status(400).json({ message: 'Invalid Token' });
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



