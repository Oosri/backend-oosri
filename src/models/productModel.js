const mongoose = require('mongoose');
const categoryEnum = require('./categoryModel');

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
    // productRating: {
    //     type: Number,
    //     required: false
    // },
    // color: {
    //     type: String,
    //     required: true
    // },
    country: {
      type: String,
      required: true
    },
    condition: {
      type: String,
      required: true
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

// const tabletSchema = new Schema({
//     brand: {
//         type: String,
//         required: true
//     },
//     model: {
//         type: String,
//         required: true
//     },
//     subCondition: String,
//     displayType: String,
//     camera: String,
//     simType: {
//         type: String,
//         required: true
//     },
//     operatingSystem: {
//         type: String,
//         required: true
//     },
//     storage: {
//         type: Number,
//         required: true
//     },
// });

// const Tablet = Product.discriminator('Tablet', tabletSchema);

// const computerAccessorySchema = new Schema({
//     brand: {
//         type: String,
//         required: true
//     },
//     model: {
//         type: String,
//         required: true
//     },
//     compatibility: {
//         type: String,
//         required: true
//     },
//     connectionType: {
//         type: String,
//         required: true
//     },
//     dimension: {
//         type: String,
//         required: true
//     }
// });

// const ComputerAccessory = Product.discriminator('Computer-accessories', computerAccessorySchema);

// const wristwatchSchema = new Schema({
//     brand: {
//         type: String,
//         required: true
//     },
//     bandMaterial: {
//         type: String,
//         required: true
//     },
// });

// const Wristwatch = Product.discriminator('Wristwatch', wristwatchSchema);

// const mobilePhoneSchema = new Schema({
//     brand: {
//         type: String,
//         required: true
//     },
//     model: {
//         type: String,
//         required: true
//     },
//     subCondition: String,
//     displayType: String,
//     camera: String,
//     simType: {
//         type: String,
//         required: true
//     },
//     operatingSystem: {
//         type: String,
//         required: true
//     },
//     storage: {
//         type: Number,
//         required: true
//     },
// });

// const MobilePhone = Product.discriminator('Mobile-phone', mobilePhoneSchema);

// module.exports = {
//     Product,
//     MobilePhone,
//     Wristwatch,
//     Tablet,
//     ComputerAccessory
// };
