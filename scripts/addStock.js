/**
 * Script to add stock to a product for testing
 * Run with: node scripts/addStock.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function addStock() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const { Product } = require('../src/models/productModel');

        const productId = '693806fd5b47c5df7495a795';

        const result = await Product.findByIdAndUpdate(
            productId,
            {
                $set: {
                    inStock: 100,
                    productStatus: 'approved',
                    isVisible: true
                }
            },
            { new: true }
        );

        if (result) {
            console.log('\n✅ Product updated:');
            console.log('  ID:', result._id);
            console.log('  Name:', result.productName);
            console.log('  Stock:', result.inStock);
            console.log('  Status:', result.productStatus);
            console.log('  Visible:', result.isVisible);
        } else {
            console.log('❌ Product not found!');
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

addStock();
