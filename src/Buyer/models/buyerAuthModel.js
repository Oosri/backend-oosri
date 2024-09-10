const mongoose = require('mongoose');

const buyerSchema = new mongoose.Schema({
  email: String,
  password: String,
  fullName: String,
  userRoles: { type: String, default: 'buyer' },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  phoneNumber: String,
  isConfirmed: { type: Boolean, default: false }
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

// improves query performance
buyerSchema.index({ email: 1 });

module.exports = mongoose.model('Buyer', buyerSchema);
