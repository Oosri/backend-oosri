const proxyquire = require('proxyquire');
const assert = require('assert');

// Mocks
const mockFxRate = 1 / 1500; // 1 USD = 1500 NGN

const mockProduct = {
    _id: 'prod1',
    productName: 'Test Product',
    regularPrice: 15000, // 10 USD
    images: ['img1.jpg'],
    category: { _id: 'cat1', name: 'Category' }, // populated category
};

const mockCartItem = {
    productId: mockProduct, // populated
    quantity: 2
};

const mockCart = {
    _id: 'cart1',
    items: [mockCartItem],
    save: async () => { },
    populate: function () { return this; }
};

// Mock Query object for general chaining
const mockQuery = {
    populate: function () { return this; },
    select: function () { return this; },
    limit: async function () { return []; }, // For related products
    then: function (resolve) { resolve(mockCart); } // Treat as Promise-like for await
};

// Specific mock for findOne (returns cart)
const mockCartQuery = {
    populate: async () => mockCart
};

// Specific mock for Product.find (returns related products array in limit)
const mockProductFindQuery = {
    select: function () { return this; },
    limit: async function () { return []; }
};

// Specific mock for Product.findById (returns product)
const mockProductFindByIdQuery = {
    select: function () { return this; },
    populate: async () => mockProduct
};


const mockUserCartModel = {
    findOne: () => mockCartQuery,
    findById: async () => mockCart
};

const mockProductModel = {
    Product: {
        find: () => mockProductFindQuery,
        findById: () => mockProductFindByIdQuery
    }
};

const mockDbHelper = {
    checkObjectId: () => true,
    formatMongoData: (data) => data
};

const mockCartFunction = {
    retrieveOrCreateCart: async () => mockCart
};

const mockFxService = {
    getFxRateNGNtoUSD: async () => mockFxRate
};

const mockConstants = {
    CartMessage: {
        USER_ID_CART_KEY_REQUIRED: 'User ID or Cart Key is required',
        EMPTY_CART: 'Cart is empty'
    },
    buyerProductMessage: {
        INVALID_PRODUCT_ID: 'Invalid Product ID'
    }
};

// Load Service with Mocks
const buyerCartService = proxyquire('../src/Buyer/Service/buyerCartService', {
    '../../Buyer/models/buyerCartModel': mockUserCartModel,
    '../../models/productModel': mockProductModel,
    '../helper/dbHelper': mockDbHelper,
    '../constants': mockConstants,
    '../../Buyer/models/guestCartModel': {},
    '../helper/cartFunction': mockCartFunction,
    './fxService': mockFxService
});

async function runTest() {
    console.log('Starting USD Cart Verification...');

    try {
        // Test retrieveUserCart
        const result = await buyerCartService.retrieveUserCart({ userId: 'user1' });

        console.log('Result:', JSON.stringify(result, null, 2));

        // Assertions
        const item = result.cartItems[0];
        assert.strictEqual(item.price, 15000, 'Price should be 15000 NGN');
        assert.strictEqual(item.priceInUsd, 10.00, 'Price in USD should be 10.00'); // 15000 / 1500

        assert.strictEqual(item.totalAmount, 30000, 'Total Amount should be 30000 NGN');
        assert.strictEqual(item.totalAmountInUsd, 20.00, 'Total Amount in USD should be 20.00');

        const summary = result.cartSummary;
        assert.strictEqual(summary.subtotal, 30000);
        assert.strictEqual(summary.subtotalInUsd, 20.00);

        console.log('✅ Verification Passed: USD prices are correctly calculated.');
    } catch (error) {
        console.error('❌ Verification Failed:', error);
        process.exit(1);
    }
}

runTest();
