const mongoose = require('mongoose');

const courierServiceSchema = new mongoose.Schema({
  name: { type: String, required: true,unique: true, sparse: true },
  image: String,
}, {
  timestamps: true,
  toObject: {
    transform: function (doc, ret, options) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});


module.exports = mongoose.model('CourierService', courierServiceSchema);
