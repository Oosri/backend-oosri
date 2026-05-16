const mongoose = require('mongoose');

const validateObjectId = (paramName = 'id') => (req, res, next) => {
  const value = req.params[paramName];
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: `Invalid ${paramName}: must be a valid MongoDB ObjectId`,
    });
  }
  next();
};

module.exports = validateObjectId;
