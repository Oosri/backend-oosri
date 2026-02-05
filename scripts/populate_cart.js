const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

// Models and services
const buyerCartService = require('../src/Buyer/Service/buyerCartService');
const Product = require('../src/models/productModel').Product;

// Connect to MongoDB
async function connectDb() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/oosri';
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');
}

// Main function to populate cart
async function populateCart(userId) {
    // Fetch first 3 active products (adjust as needed)
    const products = await Product.find({}).limit(3);
    if (products.length === 0) {
        console.log('No products found in the database.');
        return;
    }

    const items = products.map(p => ({
        productId: p._id,
        quantity: Math.floor(Math.random() * 3) + 1 // random qty 1-3
    }));

    console.log('Adding items to cart for user', userId, ':', items);

    const result = await buyerCartService.addToCart({
        userId,
        cartKey: null, // let service create/retrieve cart based on userId
        items
    });

    console.log('Cart populated. Result:', JSON.stringify(result, null, 2));
}

(async () => {
    try {
        await connectDb();
        const userId = '6952ca9edf24a13a98ecd17a'; // provided by user
        await populateCart(userId);
        process.exit(0);
    } catch (err) {
        console.error('Error populating cart:', err);
        process.exit(1);
    }
})();
