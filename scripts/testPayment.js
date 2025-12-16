/**
 * Payment Testing Script
 * Run with: node scripts/testPayment.js
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:8000/api/v1';

// Test data from database
const TEST_DATA = {
    buyerId: '6931ee9bf1d1e7d36c044c75',
    sellerId: '692f25f24fdea6b2fba6b5b5',
    productId: '693806fd5b47c5df7495a795'
};

// Generate a test token
function generateToken(userId) {
    return jwt.sign(
        { userId, email: 'test@test.com' },
        process.env.JWT_SECRET || 'my-secret-key',
        { expiresIn: '1h' }
    );
}

async function testCreatePaymentIntent() {
    console.log('\n=== TEST 1: Create Multi-Vendor Payment Intent ===\n');

    const token = generateToken(TEST_DATA.buyerId);

    const payload = {
        buyerId: TEST_DATA.buyerId,
        currency: 'usd',
        sellers: [
            {
                sellerId: TEST_DATA.sellerId,
                amount: 5000, // $50.00 in cents
                items: [
                    {
                        productId: TEST_DATA.productId,
                        name: 'Amazing',
                        quantity: 2,
                        price: 2500, // $25.00 each
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
    console.log('\nMaking request to:', `${BASE_URL}/buyer/payment/create-multi-vendor-payment-intent`);

    try {
        const response = await fetch(`${BASE_URL}/buyer/payment/create-multi-vendor-payment-intent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        console.log('\nResponse status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('\n✅ SUCCESS!');
            console.log('Client Secret:', data.clientSecret?.substring(0, 30) + '...');
            console.log('Payment Intent ID:', data.paymentIntentId);
            console.log('Total Amount:', data.totalAmount, 'cents');
            return data;
        } else {
            console.log('\n❌ FAILED');
            return null;
        }
    } catch (error) {
        console.log('\n❌ ERROR:', error.message);
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
                amount: 500000, // Large amount
                items: [
                    {
                        productId: TEST_DATA.productId,
                        name: 'Amazing',
                        quantity: 99999, // Exceeds stock
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

    try {
        const response = await fetch(`${BASE_URL}/buyer/payment/create-multi-vendor-payment-intent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        console.log('\nResponse status:', response.status);

        if (response.status === 400 && data.stockIssues) {
            console.log('✅ Stock validation correctly rejected the request!');
            console.log('Stock issues:', JSON.stringify(data.stockIssues, null, 2));
        } else {
            console.log('Response:', JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.log('❌ ERROR:', error.message);
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
        console.log('1. Run: stripe listen --forward-to localhost:8000/buyer/payment/webhook');
        console.log('2. Run: stripe trigger payment_intent.succeeded');
        console.log(`   Or use Payment Intent ID: ${result.paymentIntentId}`);
    }
}

main();
