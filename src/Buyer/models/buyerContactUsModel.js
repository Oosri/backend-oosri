const mongoose = require('mongoose');

const buyerContactUsSchema = new mongoose.Schema({
  email: { type: String, required: true },
  fullName: { type: String, required: true },
  message: { type: String, required: true },
  
}, {
  timestamps: true,
  toObject: {
    transform: function (doc, ret, options) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.password;
      delete ret.createdAt;
      delete ret.updatedAt;
      delete ret.__v;
      return ret;
    }
  }
});



module.exports = mongoose.model('contactUs', buyerContactUsSchema);
