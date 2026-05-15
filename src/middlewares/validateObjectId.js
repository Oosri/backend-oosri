const mongoose = require('mongoose');

const validateObjectId = (paramName) => (req, res, next) => {
  const id = req.params[paramName];
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: `Invalid ${paramName}: not a valid ObjectId` });
  }
  next();
};

module.exports = validateObjectId;
