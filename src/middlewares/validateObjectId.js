const mongoose = require('mongoose');

/**
 * Returns middleware that validates a named route parameter is a valid MongoDB ObjectId.
 * Responds with 400 immediately if the value is malformed, preventing Mongoose CastErrors.
 *
 * Usage:  router.get('/:id', validateObjectId('id'), handler)
 */
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
