const mongoose = require('mongoose');

const buyerSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  fullName: { type: String, required: true },
  googleId: { type: String, unique: true, sparse: true },  
  userRoles: { type: String, default: 'buyer' },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  phoneNumber: { type: String },
  authProviders: {
    googleLinked: { type: Boolean, default: false },
    localPasswordEnabled: { type: Boolean, default: false },
  },
  lastLogin: { type: String },
  updatedLastLogin: { type: String },
  profileImage: String,
  refreshTokenHash: { type: String },
  isConfirmed: { type: Boolean, default: false },
  isSuspended: { type: Boolean, default: false },
  suspensionReason: { type: String },
  deliveryAddresses: [{
    address: String,
    postalCode: String,
    cityName: String,
    countryCode: String,
    countryName: String,
    isDefault: { type: Boolean, default: false },
  }],

}, {
  timestamps: true,
  toObject: {
    transform: function (doc, ret, options) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.password;
      delete ret.updatedLastLogin;
      delete ret.updatedAt;
      delete ret.__v;
      return ret;
    }
  }
});


buyerSchema.index({ isSuspended: 1, createdAt: -1 });
buyerSchema.index({ isConfirmed: 1, createdAt: -1 });
buyerSchema.index({ refreshTokenHash: 1 }, { sparse: true });

module.exports = mongoose.model('Buyer', buyerSchema);
