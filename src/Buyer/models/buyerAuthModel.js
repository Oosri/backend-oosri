const mongoose = require('mongoose');

const buyerSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  fullName: { type: String, required: true },
  googleId: { type: String, unique: true, sparse: true },  
  userRoles: { type: String, default: 'buyer' },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  phoneNumber: { type: String },
  lastLogin: { type: String },
  updatedLastLogin: { type: String },
  profileImage: String,
  refreshToken: { type: String }, 
  isConfirmed: { type: Boolean, default: false },
  deliveryAddresses: [{
    address: String,
  }],

}, {
  timestamps: true,
  toObject: {
    transform: function (doc, ret, options) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.password;
      delete ret.updatedLastLogin,
      delete ret.createdAt;
      delete ret.updatedAt;
      delete ret.__v;
      return ret;
    }
  }
});


module.exports = mongoose.model('Buyer', buyerSchema);
