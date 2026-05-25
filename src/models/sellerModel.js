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
      },
      phoneNumber: {
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
      },
      phoneNumber: {
        type: String
      }
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    available_balance_cents: {
      type: Number,
      default: 0
    },
    is_frozen: {
      type: Boolean,
      default: false
    },
    refreshToken: {
      type: String,
      default: null
    },
    refreshTokenExpiry: {
      type: Date,
      default: null
    },
    productUploadReminderSent: {
      type: Boolean,
      default: false
    },
    productUploadReminderSentAt: {
      type: Date
    },
    sellerStatus: {
      type: String,
      enum: ['Pending', 'Unverified', 'Verified', 'Revoked'],
      default: 'Unverified'
    },
    isSuspended: {
      type: Boolean,
      default: false
    },
    suspendedAt: {
      type: Date,
      default: null
    },
    suspendReason: {
      type: String,
      default: null
    },
    storeProfile: {
      storeName: {
        type: String,
        trim: true,
        lowercase: true,
        sparse: true,
      },
      bannerImage: { type: String },
      description: { type: String, maxlength: 600 },
      socialLinks: {
        instagram: { type: String },
        twitter: { type: String },
        facebook: { type: String },
        tiktok: { type: String },
        website: { type: String },
      },
    },
  },
  {
    timestamps: true,
    toObject: {
      transform: (doc, ret, options) => {
        ret.id = ret._id;
        delete ret.password;
        delete ret._id;
        delete ret.createdAt;
        delete ret.updatedAt;
        delete ret.__v;
        delete ret.refreshToken;
        delete ret.refreshTokenExpiry;
        return ret;
      }
    }
  }
);

sellerSchema.index({ isVerified: 1, createdAt: -1 });
sellerSchema.index({ businessType: 1, isVerified: 1 });
sellerSchema.index({ createdAt: -1 });
sellerSchema.index({ refreshToken: 1 }, { sparse: true });

module.exports = mongoose.model('Seller', sellerSchema);
