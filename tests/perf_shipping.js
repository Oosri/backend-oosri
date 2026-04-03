
const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:8000/api/v1';

async function runTest() {
    console.log('🚀 Starting Shipping Performance Test...');

    // 1. Login as Buyer
    let token;
    let addressId;
    let productId;

    try {
        const loginRes = await axios.post(`${BASE_URL}/auth/buyer/login`, {
            email: process.env.TEST_BUYER_EMAIL || 'test_buyer@oosri.com',
            password: process.env.TEST_BUYER_PASSWORD || 'password123'
        });
        token = loginRes.data.token;
    } catch (err) {
        console.error('❌ Login Failed:', err.message);
        return;
    }

    // 2. Get Prerequisites (Address & Product)
    try {
        const profileRes = await axios.get(`${BASE_URL}/profile/buyer/delivery-addresses`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // Response structure: { status: 200, success: true, message: '...', data: [...] }
        const addresses = profileRes.data.data || profileRes.data;
        addressId = addresses[0]?._id;

        const searchRes = await axios.get(`${BASE_URL}/products/seller/search?query=test`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        productId = searchRes.data.products?.[0]?._id || searchRes.data[0]?._id;

        if (!addressId || !productId) {
            console.error('❌ Missing Address or Product');
            return;
        }
    } catch (err) {
        console.error('❌ Setup Failed:', err.message);
        return;
    }

    // 3. Test Shipping Endpoint
    const payload = {
        addressId: addressId,
        items: [{ productId: productId, quantity: 1 }]
    };

    console.log('📡 Request 1: Warming up cache...');
    const start1 = Date.now();
    try {
        await axios.post(`${BASE_URL}/buyer/dhl-shipping/get-shipping-fee`, payload, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const duration1 = Date.now() - start1;
        console.log(`⏱️ Request 1 Duration: ${duration1}ms`);

        console.log('📡 Request 2: Testing Cache...');
        const start2 = Date.now();
        await axios.post(`${BASE_URL}/buyer/dhl-shipping/get-shipping-fee`, payload, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const duration2 = Date.now() - start2;
        console.log(`⏱️ Request 2 Duration: ${duration2}ms`);

        if (duration2 < duration1 && duration2 < 500) {
            console.log('✅ Caching is WORKING (Significant speedup observed)');
        } else {
            console.log('⚠️ Caching might not be working or network jitter.');
        }

    } catch (err) {
        console.error('❌ Shipping Request Failed:', err.response?.data || err.message);
    }
}

runTest();
