const express = require('express');
const proxyquire = require('proxyquire');
const assert = require('assert');

// 1. MOCK DATA & CONSTANTS
const constants = {
    CartMessage: { EMPTY_CART: 'Cart is empty', USER_ID_CART_KEY_REQUIRED: 'User ID or Cart Key required', CART_FETCHED: 'Cart fetched successfully' },
    customServerResponse: { status: 200, message: '', body: {} },
    buyerProductMessage: { INVALID_PRODUCT_ID: 'Invalid product ID' }
};

const mongoDbDataFormat = {
    checkObjectId: (id) => true,
    formatMongoData: (data) => data,
    getSellerDetails: async (id) => ({ firstName: 'Test', lastName: 'Seller' })
};

const fxService = { getFxRateNGNtoUSD: async () => 0.00125 };

// Mock 20 Items
const itemsList = [];
const productMap = {};
for (let i = 1; i <= 20; i++) {
    itemsList.push({ productId: `prod${i}`, quantity: 1 });
    productMap[`prod${i}`] = {
        _id: `prod${i}`,
        productName: `Product ${i}`,
        regularPrice: 1000 * i,
        images: [],
        seller: 'seller1'
    };
}

// 2. MOCK MODELS
const userCartModel = {
    findOne: () => ({ items: itemsList })
};

const productModel = {
    Product: {
        populate: async (items) => {
            items.forEach(item => { item.productId = productMap[item.productId]; });
            return items;
        },
        findById: (id) => Promise.resolve(productMap[id]),
        find: () => ({ select: () => ({ limit: () => Promise.resolve([]) }) })
    }
};

const buyerProductReviewModel = { find: () => Promise.resolve([]) };

// 3. LOAD SERVICE (REAL SERVICE LOGIC, MOCKED DB)
const buyerCartService = proxyquire('../src/Buyer/Service/buyerCartService', {
    '../../Buyer/models/buyerCartModel': userCartModel,
    '../../models/productModel': productModel,
    '../../Buyer/models/buyerProductReviewModel': buyerProductReviewModel,
    '../helper/dbHelper': mongoDbDataFormat,
    '../constants': constants,
    '../../Buyer/models/guestCartModel': {},
    '../helper/cartFunction': {},
    './fxService': fxService
});

// 4. LOAD CONTROLLER (INJECTING THE MOCKED SERVICE)
const buyerCartController = proxyquire('../src/Buyer/controllers/buyerCartController .js', {
    '../../Buyer/Service/buyerCartService': buyerCartService,
    '../constants': constants
});

// 5. SETUP EXPRESS APP
const app = express();
app.use((req, res, next) => {
    req.user = { id: 'user123' }; // Simulate Logged In User
    next();
});

// Route
app.get('/api/v1/buyer/cart', buyerCartController.retrieveUserCart);

// 6. RUN TEST
const server = app.listen(0, async () => {
    const port = server.address().port;
    console.log(`Test Server running on port ${port}`);

    try {
        // We use dynamic import for 'axios' if not using supertest, but let's just use http core or simple fetch if node > 18.
        // Assuming node environment has http.
        const http = require('http');

        console.log('\n--- Making Request: GET /api/v1/buyer/cart?page=1&limit=5 ---');

        http.get(`http://localhost:${port}/api/v1/buyer/cart?page=1&limit=5`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const json = JSON.parse(data);
                console.log('\nRESPONSE STATUS:', res.statusCode);
                console.log('RESPONSE BODY SUMMARY:');
                console.log(`- Message: ${json.message}`);
                console.log(`- Current Page: ${json.body.currentPage}`);
                console.log(`- Total Pages: ${json.body.totalPages}`);
                console.log(`- Items Returned: ${json.body.cartItems.length}`);

                console.log('- First Item:', json.body.cartItems[0].productName);
                console.log('- Fifth Item:', json.body.cartItems[4].productName);

                // Verification
                if (json.body.cartItems.length === 5 && json.body.currentPage === 1 && json.body.totalPages === 4) {
                    console.log('\n✅ ENDPOINT TEST PASSED');
                } else {
                    console.error('\n❌ ENDPOINT TEST FAILED');
                }
                server.close();
            });
        });

    } catch (error) {
        console.error('Test Failed:', error);
        server.close();
    }
});
