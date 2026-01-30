const proxyquire = require('proxyquire');
const assert = require('assert');

// MOCK: Constants
const constants = {
    buyerProductMessage: { PRODUCT_NOT_FOUND: 'Product not found' },
    buyerSavedItemsMessage: { BUYER_SAVED_ITEM_EXIST: 'Item exists' }
};

// MOCK: DB Helper
const mongoDbDataFormat = {
    checkObjectId: (id) => true,
    formatMongoData: (data) => data,
    getSellerDetails: async (id) => ({ firstName: 'Test', lastName: 'Seller' })
};

// MOCK: FX Service
const fxService = { getFxRateNGNtoUSD: async () => 0.00125 };

// MOCK: Models
const mockProduct = {
    _id: 'prod123',
    productName: 'Test Product',
    regularPrice: 50000,
    salesPrice: 45000,
    previousPrice: 55000,
    category: { name: 'Electronics' },
    subcategory: { name: 'Phones' },
    seller: 'seller123',
    images: ['img1.jpg']
};

const ITEMS_PER_PAGE = 5;
const TOTAL_ITEMS = 12;

const buyerSavedItemsModel = {
    countDocuments: () => Promise.resolve(TOTAL_ITEMS),
    find: () => {
        let skipVal = 0;
        let limitVal = 10;

        const query = {
            skip: (val) => { skipVal = val; return query; },
            limit: (val) => { limitVal = val; return query; },
            populate: () => {
                // Return fake items based on skip/limit
                const items = [];
                const countToReturn = Math.min(limitVal, TOTAL_ITEMS - skipVal);

                if (countToReturn > 0) {
                    for (let i = 0; i < countToReturn; i++) {
                        items.push({
                            _id: `saved${skipVal + i}`,
                            userId: 'user123',
                            productId: mockProduct, // already populated
                            createdAt: new Date()
                        });
                    }
                }
                return Promise.resolve(items);
            }
        };
        return query;
    }
};

const buyerProductReviewModel = { find: () => Promise.resolve([]) };

// LOAD SERVICE
const buyerSavedItemsService = proxyquire('../src/Buyer/Service/buyerSavedItemsService', {
    '../../Buyer/models/buyerSavedItemsModel': buyerSavedItemsModel,
    '../../models/productModel': {},
    '../../Buyer/models/buyerProductReviewModel': buyerProductReviewModel,
    '../helper/dbHelper': mongoDbDataFormat,
    '../constants': constants,
    './fxService': fxService
});

async function runVerification() {
    console.log('Running SavedItems Pagination Verification...');
    try {
        // TEST CASE: Page 1, Limit 5
        console.log('Test 1: Page 1, Limit 5');
        const result1 = await buyerSavedItemsService.retrieveBuyerSavedItems('user123', 1, 5);

        console.log(`- Returned Items: ${result1.savedItems.length}`);
        console.log(`- Total Items: ${result1.totalItems}`);
        console.log(`- Total Pages: ${result1.totalPages}`);
        console.log(`- Current Page: ${result1.currentPage}`);

        assert.strictEqual(result1.savedItems.length, 5, 'Should return 5 items');
        assert.strictEqual(result1.totalItems, 12, 'Total items should be 12');
        assert.strictEqual(result1.totalPages, 3, 'Total pages should be 3'); // ceil(12/5)
        assert.strictEqual(result1.currentPage, 1);

        // TEST CASE: Page 3, Limit 5
        console.log('\nTest 2: Page 3, Limit 5');
        const result2 = await buyerSavedItemsService.retrieveBuyerSavedItems('user123', 3, 5);

        console.log(`- Returned Items: ${result2.savedItems.length}`);
        console.log(`- Current Page: ${result2.currentPage}`);

        assert.strictEqual(result2.savedItems.length, 2, 'Should return remaining 2 items (12-10)');
        assert.strictEqual(result2.currentPage, 3);

        console.log('\n✅ SAVED ITEMS PAGINATION VERIFIED');
    } catch (error) {
        console.error('❌ VERIFICATION FAILED:', error);
        process.exit(1);
    }
}

runVerification();
