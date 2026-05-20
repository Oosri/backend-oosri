const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const otpCodeSchema = new Schema({
  email: { type: String, required: true, index: true },
  code:  { type: String, required: true },
  expiration: { type: Date, required: true },
});

// Auto-delete expired OTP documents from MongoDB
otpCodeSchema.index({ expiration: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpCode', otpCodeSchema);