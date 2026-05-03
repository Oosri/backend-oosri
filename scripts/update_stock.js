require('dotenv').config();
const mongoose = require('mongoose');
const dbConnect = require('../src/configs/database');
const { Product } = require('../src/models/productModel');

const updateStock = async () => {
    try {
        await dbConnect();
        
        console.log('Updating stock for all products...');
        const result = await Product.updateMany({}, { $set: { inStock: 5 } });
        
        console.log(`Successfully updated ${result.modifiedCount} out of ${result.matchedCount} products.`);
    } catch (error) {
        console.error('Error updating stock:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed.');
        process.exit(0);
    }
};

updateStock();
