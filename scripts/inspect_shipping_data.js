const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { Product } = require('../src/models/productModel');
const Buyer = require('../src/Buyer/models/buyerAuthModel');

dotenv.config();

async function inspectData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const productId = '6952c8afdf24a13a98ecd170';
        const addressId = '695a401917ae1229de22da52';

        const product = await Product.findById(productId);
        console.log('--- Product Details ---');
        if (product) {
            console.log('Name:', product.productName);
            console.log('Weight:', product.weight);
            console.log('Dimensions:', JSON.stringify(product.dimensions, null, 2));
        } else {
            console.log('Product not found!');
        }

        // Search for address in all buyers (since addressId is likely in a subdocument)
        const buyerWithAddress = await Buyer.findOne({ 'address._id': addressId });
        console.log('\n--- Address Details ---');
        if (buyerWithAddress) {
            const address = buyerWithAddress.address.id(addressId);
            console.log(JSON.stringify(address, null, 2));
        } else {
            console.log('Address not found!');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

inspectData();
