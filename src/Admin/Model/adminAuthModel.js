const mongoose = require('mongoose');

const VALID_PERMISSIONS = [
  'orders', 'products', 'sellers', 'buyers',
  'analytics', 'categories', 'attributes',
  'payouts', 'fx', 'settings', 'returns', 'kyc',
];

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  fullName: { type: String, required: true },
  userRoles: { type: String, enum: ['admin', 'super_admin'], default: 'admin' },
  permissions: { type: [{ type: String, enum: VALID_PERMISSIONS }], default: [] },
  phoneNumber: { type: String },
  lastLogin: { type: String },
  updatedLastLogin: { type: String },
  profileImage: String,
  refreshToken: { type: String },
  isConfirmed: { type: Boolean, default: false }
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


const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;
module.exports.VALID_PERMISSIONS = VALID_PERMISSIONS;
