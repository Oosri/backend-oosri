const proxyquire = require('proxyquire');
const assert = require('assert');

// MOCK: Constants
const constants = {
    CartMessage: { EMPTY_CART: 'Cart is empty', USER_ID_CART_KEY_REQUIRED: 'User ID or Cart Key required' },
    buyerProductMessage: { INVALID_PRODUCT_ID: 'Invalid product ID' }
};

// MOCK: DB Helper
const mongoDbDataFormat = {
    checkObjectId: (id) => true,
    formatMongoData: (data) => data,
    getSellerDetails: async (id) => ({ firstName: 'Test', lastName: 'Seller' })
};

// MOCK: FX Service
const fxService = {
    getFxRateNGNtoUSD: async () => 0.00125
};

// MOCK: Product
const itemsList = [];
for (let i = 1; i <= 20; i++) {
    itemsList.push({
        productId: `prod${i}`,
        quantity: 1
    });
}

const productMap = {};
for (let i = 1; i <= 20; i++) {
    productMap[`prod${i}`] = {
        _id: `prod${i}`,
        productName: `Product ${i}`,
        regularPrice: 1000 * i,
        images: [],
        seller: 'seller1'
    };
}

// MOCK: Models
const userCartModel = {
    findOne: () => ({
        // Return a mock cart document
        items: itemsList
    })
};

const productModel = {
    Product: {
        populate: async (items, options) => {
            // Manually Populate
            items.forEach(item => {
                const pid = item.productId;
                item.productId = productMap[pid]; // Replace string/ID with object
            });
            return items;
        },
        // For related products
        find: () => ({
            select: () => ({ limit: () => Promise.resolve([]) })
        }),
        findById: (id) => Promise.resolve(productMap[id])
    }
};

const buyerProductReviewModel = {
    find: () => Promise.resolve([])
};

// LOAD SERVICE
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

async function runVerification() {
    console.log('Running Cart Pagination Verification...');
    try {
        // TEST CASE: Page 1, Limit 5
        console.log('Test 1: Page 1, Limit 5');
        const result1 = await buyerCartService.retrieveUserCart({
            userId: 'user123',
            page: 1,
            limit: 5
        });

        console.log(`- Returned Items: ${result1.cartItems.length}`);
        console.log(`- Total Items: ${result1.totalItems}`);
        console.log(`- Total Pages: ${result1.totalPages}`);
        console.log(`- First Item: ${result1.cartItems[0].productName}`);
        console.log(`- Fifth Item: ${result1.cartItems[4].productName}`);

        assert.strictEqual(result1.cartItems.length, 5, 'Should return 5 items');
        assert.strictEqual(result1.totalItems, 20, 'Total items should be 20');
        assert.strictEqual(result1.totalPages, 4, 'Total pages should be 4');
        assert.strictEqual(result1.cartItems[0]._id, 'prod1');
        assert.strictEqual(result1.cartItems[4]._id, 'prod5');


        // TEST CASE: Page 2, Limit 5
        console.log('\nTest 2: Page 2, Limit 5');
        const result2 = await buyerCartService.retrieveUserCart({
            userId: 'user123',
            page: 2,
            limit: 5
        });

        console.log(`- Returned Items: ${result2.cartItems.length}`);
        console.log(`- First Item: ${result2.cartItems[0].productName}`);

        assert.strictEqual(result2.cartItems.length, 5, 'Should return 5 items');
        assert.strictEqual(result2.cartItems[0]._id, 'prod6');


        console.log('\n✅ PAGINATION VERIFICATION PASSED');
    } catch (error) {
        console.error('❌ VERIFICATION FAILED:', error);
        process.exit(1);
    }
}

runVerification();
