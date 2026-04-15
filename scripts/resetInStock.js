/**
 * resetInStock.js
 *
 * One-off maintenance script: sets `inStock = 5` for every product in the DB.
 *
 * Usage:
 *   MONGO_URI=<your-uri> node scripts/resetInStock.js
 *
 * Or, if the project exposes a .env file that dotenv can read:
 *   node -r dotenv/config scripts/resetInStock.js
 */

'use strict';

require('dotenv').config(); // no-op if dotenv is not installed

const mongoose = require('mongoose');
const { Product } = require('../src/models/productModel');

const STOCK_VALUE = 5;

async function main() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error('❌  MONGO_URI environment variable is not set.');
    process.exit(1);
  }

  console.log('🔌  Connecting to MongoDB…');
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS:         10_000,
    socketTimeoutMS:          45_000,
  });
  console.log('✅  Connected.');

  console.log(`📦  Setting inStock = ${STOCK_VALUE} for all products…`);

  const result = await Product.updateMany(
    {},                              // match every document
    { $set: { inStock: STOCK_VALUE } }
  );

  console.log(`✅  Done. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
}

main()
  .catch((err) => {
    console.error('❌  Script failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log('🔌  Disconnected from MongoDB.');
  });
