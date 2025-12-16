/**
 * Script to get test data for payment testing
 * Run with: node scripts/getTestData.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function getTestData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Get a buyer (any buyer)
        const Buyer = require('../src/Buyer/models/buyerAuthModel');
        const buyer = await Buyer.findOne({}).lean();

        // Get a seller (any seller)
        const Seller = require('../src/models/sellerModel');
        const seller = await Seller.findOne({}).lean();

        // Get a product with any stock > 0
        const { Product } = require('../src/models/productModel');
        const product = await Product.findOne({
            inStock: { $gt: 0 }
        }).lean();

        console.log('\n=== TEST DATA ===\n');

        if (buyer) {
            console.log('BUYER:');
            console.log('  ID:', buyer._id);
            console.log('  Email:', buyer.email);
            console.log('  Status:', buyer.status);
        } else {
            console.log('❌ No buyer found in database!');
        }

        if (seller) {
            console.log('\nSELLER:');
            console.log('  ID:', seller._id);
            console.log('  Email:', seller.email);
            console.log('  Status:', seller.status);
        } else {
            console.log('❌ No seller found in database!');
        }

        if (product) {
            console.log('\nPRODUCT:');
            console.log('  ID:', product._id);
            console.log('  Name:', product.productName);
            console.log('  Price:', product.regularPrice);
            console.log('  Stock:', product.inStock);
            console.log('  Seller ID:', product.seller);
            console.log('  Status:', product.productStatus);
            console.log('  Visible:', product.isVisible);
        } else {
            console.log('❌ No product with stock found! Trying any product...');
            const anyProduct = await Product.findOne({}).lean();
            if (anyProduct) {
                console.log('\nPRODUCT (no stock):');
                console.log('  ID:', anyProduct._id);
                console.log('  Name:', anyProduct.productName);
                console.log('  Stock:', anyProduct.inStock);
            }
        }

        console.log('\n=================\n');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

getTestData();
