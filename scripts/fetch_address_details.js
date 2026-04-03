const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend-oosri directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const Buyer = require('../src/Buyer/models/buyerAuthModel');

async function getAddress() {
    try {
        if (!process.env.MONGO_URI) {
            console.error('MONGO_URI not found in environment');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const addressId = '695a401917ae1229de22da52';

        // Search for address in deliveryAddresses
        const buyerWithAddress = await Buyer.findOne({ 'deliveryAddresses._id': addressId });

        console.log('\n--- Buyer and Address Details ---');
        if (buyerWithAddress) {
            console.log('Buyer ID:', buyerWithAddress._id);
            console.log('Buyer Name:', buyerWithAddress.fullName);

            const address = buyerWithAddress.deliveryAddresses.id(addressId);
            if (address) {
                console.log('Address:', JSON.stringify(address, null, 2));
            } else {
                console.log('Address object not found in buyer document even though findOne matched.');
            }
        } else {
            console.log('Address not found in any buyer.');

            // Backup check: search in 'address' field (in case schema is different in DB)
            const buyerWithAddressOld = await Buyer.findOne({ 'address._id': addressId });
            if (buyerWithAddressOld) {
                console.log('Found in legacy "address" field.');
                console.log('Buyer ID:', buyerWithAddressOld._id);
                const address = buyerWithAddressOld.address.id(addressId);
                console.log('Address:', JSON.stringify(address, null, 2));
            } else {
                console.log('Address not found in legacy "address" field either.');
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

getAddress();
