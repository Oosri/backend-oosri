
require('dotenv').config();
const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

// Import Seller model and Controller
const Seller = require('./src/models/sellerModel');
const sellerAuthController = require('./src/controllers/sellerAuth.controller');

const app = express();
app.use(bodyParser.json());
app.post('/api/v1/auth/seller/sign-in', sellerAuthController.sellerAccountSignin);

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URI_DEV; // Fallback
console.log('DEBUG: Using MONGO_URI:', MONGO_URI ? MONGO_URI.substring(0, 20) + '...' : 'UNDEFINED');

async function runDebug() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected.');

        // 1. List Sellers
        const sellers = await Seller.find({}).select('email firstName lastName isVerified');
        console.log('\n--- Existing Sellers ---');
        if (sellers.length === 0) {
            console.log('No sellers found in DB.');
        } else {
            sellers.forEach(s => console.log(`- ${s.email} (Verified: ${s.isVerified})`));
        }

        // 2. Prompt or Pick a seller to test login? 
        // I'll try to login with a known test credential.
        const testEmail = 'test@oosri.com';
        const testPass = 'password123';

        console.log(`\n--- Attempting Login as ${testEmail} ---`);

        // Check if test user exists
        const testUser = await Seller.findOne({ email: testEmail });
        if (!testUser) {
            console.log('Test user not found. Creating...');
            // Mock request to signup? Or direct create.
            const bcrypt = require('bcryptjs');
            const salt = parseInt(process.env.SALT_ROUNDS) || 10;
            const hashedPassword = await bcrypt.hash(testPass, salt);

            await Seller.create({
                firstName: 'Test',
                lastName: 'User',
                email: testEmail,
                password: hashedPassword,
                businessType: 'Personal',
                country: 'Nigeria',
                profilePicture: 'https://via.placeholder.com/150',
                isVerified: true,
                sellerStatus: 'Verified'
            });
            console.log('Test user created.');
        } else {
            console.log('Test user exists.');
            // Ensure password is correct? We can't easily. We'll just try to login.
            // If it fails with 401, we know password is wrong.
            // If it fails with 500, we found the bug.
        }

        const res = await request(app)
            .post('/api/v1/auth/seller/sign-in')
            .send({ email: testEmail, password: testPass });

        console.log('\n--- Login Response ---');
        console.log('Status:', res.status);
        if (res.status !== 200) {
            console.log('Body:', JSON.stringify(res.body, null, 2));
        } else {
            console.log('Success! Token received.');
        }

    } catch (err) {
        console.error('Debug failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

runDebug();
