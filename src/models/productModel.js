const mongoose = require('mongoose');
const categoryEnum = require('./categoryModel').categoryEnum;

const Schema = mongoose.Schema;

const productSchema = new Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller'
    },
    category: {
      type: String,
      required: true,
      enum: categoryEnum
    },
    productName: {
      type: String,
      required: true
    },
    productDescription: {
      type: String,
      required: true
    },
    artist: {
      type: String
    },
    country: {
      type: String,
      required: true
    },
    condition: {
      type: String
    },
    quantity: {
      type: Number,
      required: true
    },
    images: [
      {
        type: String,
        required: true
      }
    ],
    price: {
      type: Number,
      required: true
    },
    discount: {
      type: Number
    },
    isApproved: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Product', productSchema);
