const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Buyer = require('./src/Buyer/models/buyerAuthModel');

async function debugAddresses() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const buyerId = '6952ca9edf24a13a98ecd17a';
        const buyer = await Buyer.findById(buyerId).lean();

        if (buyer) {
            console.log('Buyer found:', buyer.email);
            console.log('Delivery Addresses:');
            if (buyer.deliveryAddresses && buyer.deliveryAddresses.length > 0) {
                buyer.deliveryAddresses.forEach((addr, index) => {
                    console.log(`[${index}] ID: ${addr._id}`);
                    console.log(`    Address: ${addr.address}`);
                    console.log(`    City: ${addr.cityName}`);
                    console.log('-------------------------');
                });
            } else {
                console.log('No delivery addresses found for this buyer.');
            }
        } else {
            console.log('Buyer not found with ID:', buyerId);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugAddresses();
