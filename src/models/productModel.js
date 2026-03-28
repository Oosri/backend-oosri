const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const productStatus = "pending";

const productSchema = new Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true
    },

    productId: {
      type: String,
      unique: true,
      required: true,
    },

    productName: {
      type: String,
      required: true
    },
    productDescription: {
      type: String,
      required: true
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true
    },
    subcategory: {
      type: Schema.Types.ObjectId,
      ref: 'SubCategory',
      index: true
    },
    date_created: {
      type: Date,
      default: Date.now
    },
    productStatus: {
      type: String,
      required: true,
      default: productStatus
    },
    brandArtist: {
      type: String,
      required: true
    },
    total_sales: {
      type: Number
    },
    color: {
      type: String
    },
    weight: {
      type: Number
    },
    weightUnit: {
      type: String,
      enum: ['g', 'kg'],
      default: 'kg'
    },
    productBrand: {
      type: String
    },
    dimensions: {
      length: { type: Number },
      width: { type: Number },
      height: { type: Number },
      unit: {
        type: String,
        enum: ['mm', 'cm'],
        default: 'cm'
      }
    },
    images: [
      {
        type: String,
        // required: true
      }
    ],
    regularPrice: {
      type: Number,
      required: true,
      index: true
    },
    priceCurrency: {
      type: String,
      default: 'NGN',
      immutable: true,
      required: true
    },
    previousPrice: {
      type: Number,
      default: null
    },
    salesPrice: {
      type: Number,
      required: false,
      default: 0,
      index: true
    },
    inStock: {
      type: Number,
      required: false,
      default: 0
    },
    productType: {
      type: String,
      default: 'simple'
    },
    discount: {
      type: Number,
      default: 0
    },
    discountPrice: {
      type: Number,
      default: null
    },

    isApproved: {
      type: Boolean,
      default: false,
      index: true
    },
    isVisible: {
      type: Boolean,
      default: true,
      index: true
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'

    },
    // === Merged Specific Fields ===
    // Sculpture
    height: { type: Number },
    width: { type: Number },
    technique: { type: String },

    // Textiles
    yard: { type: Number },
    fabricType: { type: String },
    pattern: { type: String },

    // Pottery
    diameter: { type: Number }, // Also used in Jewelry
    clayType: { type: String },
    glaze: { type: String },

    // Jewelry
    length: { type: Number },
    stoneType: { type: String },
    metalType: { type: String },

    // Paintings
    medium: { type: String },
    condition: { type: String, enum: ['New', 'Used', 'Antique'] },
    size: { type: String },
    dimension: { type: String },

    // Dynamic Attributes
    attributes: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);

module.exports = {
  Product
};