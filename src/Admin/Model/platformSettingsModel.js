const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema({
  _singleton: { type: String, default: 'global', unique: true },

  /* Payment gateways */
  stripe: {
    enabled:              { type: Boolean, default: false },
    mode:                 { type: String, enum: ['live', 'test'], default: 'test' },
    livePublishableKey:   { type: String, default: '' },
    liveSecretKey:        { type: String, default: '' },
    testPublishableKey:   { type: String, default: '' },
    testSecretKey:        { type: String, default: '' },
    webhookSecret:        { type: String, default: '' },
  },
  paystack: {
    enabled:        { type: Boolean, default: false },
    mode:           { type: String, enum: ['live', 'test'], default: 'test' },
    livePublicKey:  { type: String, default: '' },
    liveSecretKey:  { type: String, default: '' },
    testPublicKey:  { type: String, default: '' },
    testSecretKey:  { type: String, default: '' },
  },

  /* Shipping providers */
  dhl: {
    enabled:    { type: Boolean, default: false },
    apiKey:     { type: String, default: '' },
    apiSecret:  { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    environment:   { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
  },
  fedex: {
    enabled:    { type: Boolean, default: false },
    apiKey:     { type: String, default: '' },
    apiSecret:  { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    environment:   { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
  },
  haulam: {
    enabled:    { type: Boolean, default: false },
    apiKey:     { type: String, default: '' },
    baseUrl:    { type: String, default: '' },
  },

  /* Platform flags */
  maintenanceMode:            { type: Boolean, default: false },
  maintenanceMessage:         { type: String,  default: '' },
  guestCheckoutEnabled:       { type: Boolean, default: true },
  reviewsEnabled:             { type: Boolean, default: true },
  sellerRegistrationEnabled:  { type: Boolean, default: true },
  buyerRegistrationEnabled:   { type: Boolean, default: true },
  maxProductsPerSeller:       { type: Number,  default: 100 },
  orderAutoConfirmDays:       { type: Number,  default: 7 },

}, { timestamps: true });

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
