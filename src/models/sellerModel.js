const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const sellerSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 50
    },
    lastName: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 50
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8
    },
    phone_number: {
      type: String
    },
    businessType: {
      type: String,
      required: true,
      enum: ['Personal', 'Corporate']
    },
    country: {
      type: String,
      required: true
    },
    profilePicture: {
      type: String,
      required: true
    },
    bankDetails: {
      bank: {
        type: String
      },
      accountName: {
        type: String
      },
      accountNumber: {
        type: String
      }
    },
    personalBusinessAccount: {
      dateOfBirth: {
        type: Date
      },
      residentialAddress: {
        type: String
      },
      countryIdentificationCard: {
        type: String
      }
    },
    corporateBusinessAccount: {
      companyName: {
        type: String
      },
      companyAddress: {
        type: String
      },
      vatNumber: {
        type: String
      },
      vatCertificate: {
        type: String
      },
      companyRegNum: {
        type: String
      },
      companyCertificate: {
        type: String
      },
      paymentMethod: {
        type: String
      }
    },
    isVerified: {
      type: Boolean,
      default: false
    },
<<<<<<< HEAD
    productUploadReminderSent: {
      type: Boolean,
      default: false
    },
    productUploadReminderSentAt: {
      type: Date,
      default: null
    },
=======
>>>>>>> 7acb325 (chore: fix conflicts)
    sellerStatus: {
      type: String,
      enum: ['Unverified', 'Verified', 'Revoked'],
      default: 'Unverified'
    }
  },
  {
<<<<<<< HEAD
    timestamps: true,
    toObject: {
      transform: (doc, ret, options) => {
        ret.id = ret._id;
        delete ret.password;
        delete ret._id;
        delete ret.createdAt;
        delete ret.updatedAt;
        delete ret.__v;
        return ret;
      }
=======
   timestamps: true,
    toObject: {
        transform: (doc, ret, options) => {
            ret.id = ret._id;
            delete ret.password;
            delete ret._id;
            delete ret.createdAt;
            delete ret.updatedAt;
            delete ret.__v;
            return ret;
        }
>>>>>>> 7acb325 (chore: fix conflicts)
    }
  }
);

module.exports = mongoose.model('Seller', sellerSchema);
