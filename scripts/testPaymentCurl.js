/**
 * Payment Testing Script using curl
 * Run with: node scripts/testPaymentCurl.js
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const { execSync } = require('child_process');

const BASE_URL = 'http://127.0.0.1:8000/api/v1';

// Test data from database
const TEST_DATA = {
    buyerId: '6931ee9bf1d1e7d36c044c75',
    sellerId: '692f25f24fdea6b2fba6b5b5',
    productId: '693806fd5b47c5df7495a795'
};

// Use hardcoded token provided by user
function generateToken(userId) {
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MzlhZTc5ZTdhZTNlMmQyMjlkNjc1NSIsImZ1bGxOYW1lIjoiWXVzdWZmIE9ndW5kZWppIiwiaWF0IjoxNzY1NjkxMzI2LCJleHAiOjE3NjU5NTA1MjZ9.3N-gVMoG9HHE-F04cvtvSO7xapouHiOXT19kqMWabuk";
}

function runCurl(method, url, token, data) {
    const dataStr = JSON.stringify(data).replace(/'/g, "'\\''");
    const cmd = `curl -s -X ${method} "${url}" -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d '${dataStr}'`;

    try {
        const result = execSync(cmd, { encoding: 'utf-8' });
        return JSON.parse(result);
    } catch (error) {
        console.error('Curl error:', error.message);
        return null;
    }
}

async function testCreatePaymentIntent() {
    console.log('\n=== TEST 1: Create Multi-Vendor Payment Intent ===\n');

    const token = generateToken(TEST_DATA.buyerId);
    console.log('Generated Token:', token.substring(0, 50) + '...');

    const payload = {
        buyerId: TEST_DATA.buyerId,
        currency: 'usd',
        sellers: [
            {
                sellerId: TEST_DATA.sellerId,
                amount: 5000,
                items: [
                    {
                        productId: TEST_DATA.productId,
                        name: 'Amazing',
                        quantity: 2,
                        price: 2500,
                        image: 'https://example.com/image.jpg'
                    }
                ],
                shippingAddress: {
                    street: '123 Test Street',
                    city: 'Lagos',
                    state: 'Lagos State',
                    zipCode: '100001',
                    country: 'Nigeria'
                }
            }
        ]
    };

    console.log('Request payload:', JSON.stringify(payload, null, 2));

    const url = `${BASE_URL}/buyer/payment/create-multi-vendor-payment-intent`;
    console.log('\nMaking request to:', url);

    const data = runCurl('POST', url, token, payload);

    if (data) {
        console.log('\nResponse:', JSON.stringify(data, null, 2));

        if (data.clientSecret) {
            console.log('\n✅ SUCCESS!');
            console.log('Client Secret:', data.clientSecret?.substring(0, 30) + '...');
            console.log('Payment Intent ID:', data.paymentIntentId);
            console.log('Total Amount:', data.totalAmount, 'cents');
            return data;
        } else {
            console.log('\n❌ FAILED - No client secret returned');
            return null;
        }
    } else {
        console.log('\n❌ FAILED - No response');
        return null;
    }
}

async function testStockValidationFailure() {
    console.log('\n=== TEST 2: Stock Validation Failure ===\n');

    const token = generateToken(TEST_DATA.buyerId);

    const payload = {
        buyerId: TEST_DATA.buyerId,
        currency: 'usd',
        sellers: [
            {
                sellerId: TEST_DATA.sellerId,
                amount: 500000,
                items: [
                    {
                        productId: TEST_DATA.productId,
                        name: 'Amazing',
                        quantity: 99999,
                        price: 5,
                        image: 'https://example.com/image.jpg'
                    }
                ],
                shippingAddress: {
                    street: '123 Test Street',
                    city: 'Lagos',
                    state: 'Lagos State',
                    zipCode: '100001',
                    country: 'Nigeria'
                }
            }
        ]
    };

    console.log('Testing with quantity: 99999 (should exceed stock)');

    const url = `${BASE_URL}/buyer/payment/create-multi-vendor-payment-intent`;
    const data = runCurl('POST', url, token, payload);

    if (data) {
        if (data.stockIssues) {
            console.log('✅ Stock validation correctly rejected the request!');
            console.log('Stock issues:', JSON.stringify(data.stockIssues, null, 2));
        } else {
            console.log('Response:', JSON.stringify(data, null, 2));
        }
    }
}

// Run tests
async function main() {
    console.log('====================================');
    console.log('   PAYMENT SYSTEM TESTING');
    console.log('====================================');

    // Test 1: Happy path
    const result = await testCreatePaymentIntent();

    // Test 2: Stock validation
    await testStockValidationFailure();

    console.log('\n====================================');
    console.log('   TESTING COMPLETE');
    console.log('====================================\n');

    if (result) {
        console.log('Next steps for webhook testing:');
        console.log('1. Run: stripe listen --forward-to http://127.0.0.1:8000/api/v1/buyer/payment/webhook');
        console.log('2. Run: stripe trigger payment_intent.succeeded');
        console.log(`   Or use Payment Intent ID: ${result.paymentIntentId}`);
    }
}

main();
