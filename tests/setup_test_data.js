
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Models
const Seller = require('../src/models/sellerModel'); // Check if path correct
// The controller used: require('../../models/sellerModel') from src/Buyer/controllers
// So from root/tests, it is ../src/models/sellerModel. Correct.

const Buyer = require('../src/Buyer/models/buyerAuthModel');
const { Category } = require('../src/models/categoryModel');
// Controller: require("../models/buyerAuthModel") from src/Buyer/controllers
// So from root/tests: ../src/Buyer/models/buyerAuthModel. Correct.

async function setup() {
    console.log('🛠️ Setting up Test Data...');
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');
    } catch (err) {
        console.error('❌ MongoDB Connection Failed:', err.message);
        process.exit(1);
    }

    // 1. Setup Seller
    const sellerEmail = 'test_seller@oosri.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    let seller = await Seller.findOne({ email: sellerEmail });
    if (!seller) {
        seller = await Seller.create({
            firstName: 'Test',
            lastName: 'Seller',
            email: sellerEmail,
            password: hashedPassword,
            phone_number: '08012345678',
            businessType: 'Personal',
            country: 'Nigeria',
            profilePicture: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
            isVerified: true,
            sellerStatus: 'Verified'
        });
        console.log('✅ Test Seller Created');
    } else {
        console.log('ℹ️ Test Seller already exists');
        // Ensure verified
        seller.accountStatus = 'approved';
        seller.isVerified = true;
        await seller.save();
    }

    // 2. Setup Buyer
    const buyerEmail = 'test_buyer@oosri.com';
    let buyer = await Buyer.findOne({ email: buyerEmail });
    if (!buyer) {
        buyer = await Buyer.create({
            fullName: 'Test Buyer',
            email: buyerEmail,
            password: hashedPassword,
            phoneNumber: '08087654321',
            isConfirmed: true, // isVerified was used but schema says isConfirmed
            deliveryAddresses: [{
                address: '3 Close B, Unity Estate Off Alkat way',
                cityName: 'Iju-Ishaga',
                postalCode: '100216',
                stateName: 'Lagos', // Adjusted to match schema likely
                countryName: 'Nigeria',
                countryCode: 'NG',
                isDefault: true
            }]
        });
        console.log('✅ Test Buyer Created');
    } else {
        console.log('ℹ️ Test Buyer already exists');
        // Ensure address
        if (buyer.deliveryAddresses.length === 0) {
            buyer.deliveryAddresses.push({
                address: '3 Close B, Unity Estate Off Alkat way',
                cityName: 'Iju-Ishaga',
                postalCode: '100216',
                stateName: 'Lagos',
                countryName: 'Nigeria',
                countryCode: 'NG',
                isDefault: true
            });
            await buyer.save();
            console.log('✅ Added Address to Buyer');
        }
    }

    // 3. Setup Category
    let category = await Category.findOne({ name: 'TestCategory' });
    if (!category) {
        category = await Category.create({
            name: 'TestCategory',
            description: 'Test Category Description'
        });
        console.log('✅ Test Category Created');
    } else {
        console.log('ℹ️ Test Category already exists');
    }

    console.log('🎉 Setup Complete');
    console.log(`Seller: ${sellerEmail} / ${password}`);
    console.log(`Buyer: ${buyerEmail} / ${password}`);

    // Write a small config file for tests to consume?
    // Or just rely on them hardcoding/env. 
    // I'll update the test scripts to use these values.

    process.exit(0);
}

setup();
