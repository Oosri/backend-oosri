const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const categoryEnum = require('./categoryModel').categoryEnum;

const productSchema = new Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true
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
      type: String,
      required: true,
      enum: categoryEnum
    },
    subcategory: {
      type: String
    },
    date_created: {
      type: Date,
      default: Date.now
    },
    brandArtist: {
      type: String,
      required: true 
    },
    total_sales: { type: Number
    },
    color: {
      type: String
    },
    weight: {
      type: String 
    },
    productBrand: {
      type: String 
    },
    dimensions: {
      length: { type: Number },
      width: { type: Number },
      height: { type: Number }
    },
    images: [
      {
        type: String,
        required: true
      }
    ],
    regularPrice: {
      type: Number,
      required: true
    },
    salesPrice: {
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
    isApproved: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true, discriminatorKey: 'categoryType' }
);

const sculptureSchema = new Schema({
  height: { type: Number,  required: true  },
  width: { type: Number,  required: true  },
  weight: { type: Number,  required: true  },
  technique: { type: String,  required: true  }
});

const textilesSchema = new Schema({
  length: { type: Number,  required: true  },
  width: { type: Number,  required: true  },
  weight: { type: Number,  required: true  },
  fabricType: { type: String,  required: true  },
  pattern: { type: String,  required: true  }
});

const potterySchema = new Schema({
  height: { type: Number,  required: true  },
  diameter: { type: Number,  required: true  },
  clayType: { type: String,  required: true  },
  glaze: { type: String,  required: true  }
});

const jewelrySchema = new Schema({
  length: { type: Number,  required: true  },
  diameter: { type: Number,  required: true  },
  stoneType: { type: String,  required: true  },
  metalType: { type: String,  required: true  }
});

const paintingsSchema = new Schema({
  medium: { type: String,  required: true  },
  condition: { type: String,  required: true,  enum: ['New', 'Used', 'Antique'] },
  size: { type: String,  required: true  }
});

const Product = mongoose.model('Product', productSchema);

const Sculpture = Product.discriminator('Sculpture', sculptureSchema);
const Textiles = Product.discriminator('Textiles', textilesSchema);
const Pottery = Product.discriminator('Pottery', potterySchema);
const Jewelry = Product.discriminator('Jewelry', jewelrySchema);
const Paintings = Product.discriminator('Paintings', paintingsSchema);

module.exports = {
  Product,
  Sculpture,
  Textiles,
  Pottery,
  Jewelry,
  Paintings
};
