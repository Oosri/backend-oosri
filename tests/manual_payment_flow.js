
const axios = require('axios');
const mongoose = require('mongoose');
const stripe = require('stripe'); // Helper to generate signature
require('dotenv').config();

const BASE_URL = 'http://localhost:8000/api/v1';

async function runTest() {
    console.log('🚀 Starting Payment & Queue Flow Test...');

    // 1. Database Connection (for verification)
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB for verification');
    } catch (err) {
        console.error('❌ MongoDB Connection Failed:', err.message);
        return;
    }

    // 2. Login as Buyer
    let token;
    let buyerId;
    try {
        const loginRes = await axios.post(`${BASE_URL}/auth/buyer/login`, {
            email: process.env.TEST_BUYER_EMAIL || 'test_buyer@oosri.com',
            password: process.env.TEST_BUYER_PASSWORD || 'password123'
        });
        token = loginRes.data.token;
        buyerId = loginRes.data.buyer._id; // Assuming response structure
        console.log('✅ Buyer Logged In');
    } catch (err) {
        console.error('❌ Buyer Login Failed:', err.response?.data || err.message);
        return;
    }

    // 3. Get Buyer Profile for Address
    let addressId;
    try {
        const profileRes = await axios.get(`${BASE_URL}/profile/buyer/delivery-addresses`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // Response structure: { status: 200, success: true, message: '...', data: [...] }
        const addresses = profileRes.data.data || profileRes.data;
        if (!addresses || addresses.length === 0) {
            console.error('❌ No delivery address found for buyer. Please add one.');
            return;
        }
        addressId = addresses[0]._id;
        console.log(`✅ Using Address ID: ${addressId}`);
    } catch (err) {
        console.error('❌ Profile Fetch Failed:', err.message);
        return;
    }

    // 4. Find a Product to Buy (Optimized Search)
    let productId;
    try {
        const searchRes = await axios.get(`${BASE_URL}/products/seller/search?query=test`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // Just pick the first available one
        const products = searchRes.data.products || searchRes.data; // adjust based on actual response
        if (products.length === 0) {
            console.error('❌ No products found to buy.');
            return;
        }
        productId = products[0]._id;
        console.log(`✅ Selected Product ID: ${productId}`);
    } catch (err) {
        console.error('❌ Product Search Failed:', err.message);
        return;
    }

    // 5. Create Payment Intent
    let paymentIntentId;
    let clientSecret;
    try {
        const payload = {
            buyerId: buyerId,
            items: [{ productId: productId, quantity: 1 }],
            addressId: addressId
        };
        const intentRes = await axios.post(`${BASE_URL}/buyer/payment/create-payment-intent`, payload, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        paymentIntentId = intentRes.data.paymentIntentId;
        clientSecret = intentRes.data.clientSecret;
        console.log(`✅ Payment Intent Created: ${paymentIntentId}`);
    } catch (err) {
        console.error('❌ Create Payment Intent Failed:', err.response?.data || err.message);
        // Usually fails if stock issue or shipping calc error
        return;
    }

    // 6. Simulate Stripe Webhook (Success)
    // We need to construct a valid signature using the secret from .env
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('❌ STRIPE_WEBHOOK_SECRET not found in .env. Cannot test webhook.');
        return;
    }

    const payloadObj = {
        id: 'evt_test_webhook_' + Date.now(),
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
            object: {
                id: paymentIntentId,
                object: 'payment_intent',
                status: 'succeeded',
                amount: 1000,
                currency: 'usd',
                metadata: { buyerId: buyerId }
                // Add simplified charge/balance transaction info if needed by logic
            }
        }
    };
    const payloadString = JSON.stringify(payloadObj, null, 2);

    // Compute signature
    // Since we can't easily use stripe.webhooks.generateTestHeaderString without the stripe instance configured EXACTLY same,
    // we manually compute HMAC if needed, OR relies on the fact that we have the secret.
    // Actually, `stripe.webhooks.constructEvent` in the backend will fail if signature doesn't match payload + secret.
    // So we MUST generate it correctly using the SAME payload string we send.

    // Using stripe library to generate header if possible
    const stripeLib = stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'); // Only need lib for utility if exists
    // The library usually has `stripe.webhooks.generateTestHeaderString`.
    // Let's try to calculate it manually if that method isn't available or just use the lib.

    try {
        const header = stripe.webhooks.generateTestHeaderString({
            payload: payloadString,
            secret: webhookSecret,
        });

        const webhookRes = await axios.post(`${BASE_URL}/buyer/payment/webhook`, payloadString, {
            headers: {
                'stripe-signature': header,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ Webhook Sent. Response:`, webhookRes.data);

        // 7. Verify Order Creation in DB
        // Wait a small bit for async processing
        await new Promise(r => setTimeout(r, 2000));

        // Check Payment Status
        // We can query the Payment collection directly since we are connected via Mongoose
        const Payment = mongoose.connection.collection('payments'); // using raw collection to avoid schema needs
        const paymentRecord = await Payment.findOne({ stripe_payment_intent_id: paymentIntentId });

        if (paymentRecord && paymentRecord.status === 'succeeded') {
            console.log('✅ Payment Status Updated to SUCCEEDED in DB');
        } else {
            console.log(`❌ Payment Status Mismatch. Current: ${paymentRecord?.status}`);
        }

    } catch (err) {
        console.error('❌ Webhook Simulation Failed:', err.response?.data || err.message);
    }

    mongoose.disconnect();
}

runTest();
