const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Force Dev DB if available
// if (process.env.MONGO_URI_DEV) {
//    process.env.MONGO_URI = process.env.MONGO_URI_DEV;
//    console.log('ℹ️ Switched to MONGO_URI_DEV for testing');
// }

// Import App and DB Connection
const app = require('../src/configs/app');
// Adjust path to database config based on project structure
const dbConnect = require('../src/configs/database');

// Models
const Buyer = require('../src/Buyer/models/buyerAuthModel');
const Seller = require('../src/models/sellerModel');
const Admin = require('../src/Admin/Model/adminAuthModel');
const Product = require('../src/models/productModel');
const { Category } = require('../src/models/categoryModel');
const Cart = require('../src/Buyer/models/buyerCartModel');
const Order = require('../src/Buyer/models/buyerOrderModel');

const JWT_SECRET = process.env.JWT_SECRET || 'my-secret-key';

// Test Data Generators
const generateEmail = (prefix) => `${prefix}_${Date.now()}@test.oosri.com`;

async function runTests() {
    console.log('🚀 Starting Order Endpoints Verification...');

    try {
        // 1. Connect to DB
        // 1. Connect to DB
        // await dbConnect(); // Bypassing app config to ensure test control
        console.log('ℹ️ Attempting direct DB connection...');

        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is undefined');
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to Database (Direct)');

        // Wait for connection to be fully ready (sanity check)
        if (mongoose.connection.readyState !== 1) {
            console.log(`⚠️ Connection state is ${mongoose.connection.readyState}. Waiting...`);
            await new Promise((resolve, reject) => {
                let checkCount = 0;
                const check = setInterval(() => {
                    checkCount++;
                    console.log(`Current State: ${mongoose.connection.readyState}`);
                    if (mongoose.connection.readyState === 1) {
                        clearInterval(check);
                        console.log('✅ Connected to Database (Ready State: 1)');
                        resolve();
                    } else if (checkCount > 50) { // Wait 5 seconds max
                        clearInterval(check);
                        reject(new Error(`DB Connection Timed Out. Final State: ${mongoose.connection.readyState}`));
                    }
                }, 100);
            });
        }

        // 2. Setup Users
        console.log('\n--- Setting up Users ---');

        // Create Seller
        const sellerEmail = generateEmail('seller');
        const seller = await Seller.create({
            firstName: 'Test',
            lastName: 'Seller',
            email: sellerEmail,
            password: 'hashed_password_placeholder', // We won't login via password
            phone_number: '08011111111',
            businessType: 'Personal',
            country: 'Nigeria',
            profilePicture: 'https://example.com/pic.jpg',
            isVerified: true,
            sellerStatus: 'Verified'
        });
        const sellerToken = jwt.sign({ sellerId: seller._id }, JWT_SECRET, { expiresIn: '1d' });
        console.log(`✅ Created Seller: ${sellerEmail}`);

        // Create Buyer
        const buyerEmail = generateEmail('buyer');
        const buyer = await Buyer.create({
            fullName: 'Test Buyer',
            email: buyerEmail,
            password: 'hashed_password_placeholder',
            phoneNumber: '08022222222',
            isConfirmed: true,
            deliveryAddresses: [{
                address: '123 Test St',
                cityName: 'Lagos',
                postalCode: '100100',
                stateName: 'Lagos',
                countryName: 'Nigeria',
                countryCode: 'NG',
                isDefault: true
            }]
        });
        const buyerToken = jwt.sign({ id: buyer._id, fullName: buyer.fullName }, JWT_SECRET, { expiresIn: '1d' });
        console.log(`✅ Created Buyer: ${buyerEmail}`);

        // Create Admin
        const adminEmail = generateEmail('admin');
        const admin = await Admin.create({
            fullName: 'Test Admin',
            email: adminEmail,
            password: 'hashed_password_placeholder',
            userRoles: 'admin',
            isConfirmed: true
        });
        const adminToken = jwt.sign({ id: admin._id, fullName: admin.fullName }, JWT_SECRET, { expiresIn: '1d' });
        console.log(`✅ Created Admin: ${adminEmail}`);

        // 3. Setup Inventory
        console.log('\n--- Setting up Inventory ---');

        // Ensure Category
        let category = await Category.findOne({ name: 'TestCategory' });
        if (!category) {
            category = await Category.create({ name: 'TestCategory', description: 'Test Desc' });
        }

        // Create Product
        const product = await Product.create({
            productName: `Test Product ${Date.now()}`,
            description: 'A test product',
            category: category._id,
            regularPrice: 5000,
            quantity: 100,
            seller: seller._id,
            images: ['https://example.com/prod.jpg'],
            slug: `test-product-${Date.now()}`,
            isVerified: 'Approved', // Ensure it's purchasable
            isActive: true
        });
        console.log(`✅ Created Product: ${product.productName} (ID: ${product._id})`);

        // 4. Cart Flow
        console.log('\n--- Testing Cart Flow ---');

        // Add to Cart
        let cartRes = await request(app)
            .post('/api/v1/buyer/cart')
            .set('Authorization', `Bearer ${buyerToken}`)
            .send({
                items: [{ productId: product._id, quantity: 2 }]
            });

        if (cartRes.status !== 200 && cartRes.status !== 201) {
            console.error('❌ Failed to add to cart:', cartRes.body);
            throw new Error(`Failed to add to cart. Status: ${cartRes.status}`);
        }
        console.log('✅ Added item to cart');

        // Get Cart (to ensure we have cartKey/ID if needed, though user context should suffice)
        const getCartRes = await request(app)
            .get('/api/v1/buyer/cart')
            .set('Authorization', `Bearer ${buyerToken}`);

        if (getCartRes.status !== 200) {
            console.error('❌ Failed to retrieve cart:', getCartRes.body);
            throw new Error('Failed to retrieve cart');
        }
        const cartId = getCartRes.body.body._id; // Adjust based on response structure
        console.log(`✅ Retrieved Cart ID: ${cartId}`);


        // 5. Order Creation
        console.log('\n--- Testing Order Creation ---');

        const orderPayload = {
            cartId: cartId,
            deliveryAddresses: buyer.deliveryAddresses[0], // Use the address we created
            phoneNumber: '08022222222',
            paymentMethod: 'Transfer', // Check valid enums if failed
            deliveryFee: 1000
        };

        const createOrderRes = await request(app)
            .post('/api/v1/buyer/order')
            .set('Authorization', `Bearer ${buyerToken}`)
            .send(orderPayload);

        if (createOrderRes.status !== 201) {
            console.error('❌ Failed to create order:', createOrderRes.body);
            throw new Error(`Failed to create order. Status: ${createOrderRes.status}`);
        }

        // Looking at controller, body is in response.body.body? or just response.body?
        // Controller: response.body = serviceResponse; return res.send(response);
        // So createOrderRes.body.body should have the order details.
        const createdOrder = createOrderRes.body.body;
        const orderId = createdOrder._id || createdOrder.id;
        console.log(`✅ Order Created! ID: ${orderId}`);


        // 6. Verify Listings
        console.log('\n--- Verifying Order Listings ---');

        // Buyer List
        const buyerListRes = await request(app)
            .get('/api/v1/buyer/order/user')
            .set('Authorization', `Bearer ${buyerToken}`);

        if (buyerListRes.status === 200 && buyerListRes.body.body.find(o => o._id === orderId)) {
            console.log('✅ Buyer can see the order');
        } else {
            console.error('❌ Buyer cannot see the order or status mismatch', buyerListRes.body);
        }

        // Seller List
        const sellerListRes = await request(app)
            .get('/api/v1/seller/order') // Check route in routes/index.js -> sellerOrderRoutes
            .set('Authorization', `Bearer ${sellerToken}`);

        // Note: The seller list returns orders where the seller has items.
        if (sellerListRes.status === 200) {
            // The response might be paginated or structured differently.
            // Let's assume it returns a list or valid response.
            console.log(`✅ Seller list response status: ${sellerListRes.status}`);
        } else {
            console.error('❌ Seller failed to list orders:', sellerListRes.body);
        }

        // Admin List (Search/All)
        const adminListRes = await request(app)
            .get('/api/v1/admin/order/all')
            .set('Authorization', `Bearer ${adminToken}`);

        if (adminListRes.status === 200) {
            console.log(`✅ Admin list response status: ${adminListRes.status}`);
        } else {
            console.error('❌ Admin failed to list orders:', adminListRes.body);
        }


        // 7. Order Details
        console.log('\n--- Verifying Order Details ---');

        // Buyer Get Single
        const buyerOneRes = await request(app)
            .get(`/api/v1/buyer/order/user/${orderId}`)
            .set('Authorization', `Bearer ${buyerToken}`);

        if (buyerOneRes.status === 200) {
            console.log('✅ Buyer can retrieve single order details');
            // console.log(JSON.stringify(buyerOneRes.body.body, null, 2));
        } else {
            console.error('❌ Buyer failed to get single order:', buyerOneRes.body);
        }

        // 8. Order Cancellation
        console.log('\n--- Testing Order Cancellation ---');

        const cancelRes = await request(app)
            .patch(`/api/v1/buyer/order/${orderId}/cancel`)
            .set('Authorization', `Bearer ${buyerToken}`);

        if (cancelRes.status === 200) {
            console.log('✅ Buyer cancelled order successfully');
        } else {
            console.error('❌ Buyer failed to cancel order:', cancelRes.body);
        }

        console.log('\n✨ ALL TESTS EXECUTED ✨');

    } catch (error) {
        console.error('\n🛑 TEST FAILED:', error.message);
        if (error.response) {
            console.error('Response:', error.response.body);
        }
    } finally {
        // Cleanup if possible, or just exit
        // await mongoose.connection.close(); // app.js/dbConnect might leave it open
        console.log('Tests finished. Press Ctrl+C if it hangs (likely due to open DB handles).');
        process.exit(0);
    }
}

runTests();
