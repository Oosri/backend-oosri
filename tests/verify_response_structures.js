const proxyquire = require('proxyquire');
const assert = require('assert');

// MOCK: Constants
const constants = {
    buyerProductMessage: { PRODUCT_NOT_FOUND: 'Product not found' },
    buyerSavedItemsMessage: { BUYER_SAVED_ITEM_EXIST: 'Item exists' },
    CartMessage: { EMPTY_CART: 'Cart is empty', USER_ID_CART_KEY_REQUIRED: 'User ID or Cart Key required' }
};

// MOCK: DB Helper
const mongoDbDataFormat = {
    checkObjectId: (id) => true,
    formatMongoData: (data) => data,
    getSellerDetails: async (id) => ({ firstName: 'Test', lastName: 'Seller' })
};

// MOCK: FX Service
const fxService = {
    getFxRateNGNtoUSD: async () => 0.00125 // Example rate
};

// MOCK: Common Data
const mockProduct = {
    _id: 'prod123',
    productId: 'P-123',
    productName: 'Test Product',
    regularPrice: 50000,
    salesPrice: 45000,
    previousPrice: 55000,
    price: 50000,
    category: { _id: 'cat1', name: 'Electronics' }, // populated
    subcategory: { _id: 'sub1', name: 'Phones' }, // populated
    seller: 'seller123',
    images: ['img1.jpg'],
    productPrice: 50000,
    isVisible: true
};

const mockRating = 4.5;

// MOCK: Models
const productModel = {
    Product: {
        findById: () => ({
            populate: () => ({ populate: () => Promise.resolve(mockProduct) })
        }),
        find: () => ({
            populate: () => ({ populate: () => ({ skip: () => ({ limit: () => Promise.resolve([mockProduct]) }) }) }),
            select: () => ({ limit: () => Promise.resolve([]) }) // for related products
        }),
        countDocuments: () => Promise.resolve(1)
    },
    Category: {}, SubCategory: {}, Sculpture: {}, Textiles: {}, Pottery: {}, Jewelry: {}, Paintings: {}
};

const buyerProductReviewModel = {
    find: () => Promise.resolve([{ productRating: 5 }, { productRating: 4 }]), // Avg 4.5
};

const buyerSavedItemsModel = {
    find: () => ({
        populate: () => Promise.resolve([{
            _id: 'saved123',
            userId: 'user123',
            productId: mockProduct,
            createdAt: new Date()
        }])
    }),
    findOne: () => Promise.resolve(null),
    save: () => Promise.resolve({})
};

const userCartModel = {
    findOne: () => ({
        populate: () => ({
            items: [{
                productId: mockProduct, // In retrieveUserCart loop, sometimes it re-fetches.
                quantity: 2
            }]
        })
    })
};

const categoryModel = {
    Category: { find: () => ({ select: () => Promise.resolve([]) }) },
    SubCategory: { find: () => ({ select: () => Promise.resolve([]) }) }
};

// MOCK: Algolia (Stub)
const algoliasearch = () => ({ initIndex: () => ({}) });

// LOAD SERVICES
const buyerSavedItemsService = proxyquire('../src/Buyer/Service/buyerSavedItemsService', {
    '../../Buyer/models/buyerSavedItemsModel': buyerSavedItemsModel,
    '../../models/productModel': productModel,
    '../../Buyer/models/buyerProductReviewModel': buyerProductReviewModel,
    '../helper/dbHelper': mongoDbDataFormat,
    '../constants': constants,
    './fxService': fxService
});

const buyerProductService = proxyquire('../src/Buyer/Service/buyerProductService', {
    '../../models/productModel': productModel,
    '../../models/categoryModel': categoryModel,
    '../helper/dbHelper': mongoDbDataFormat,
    '../constants': constants,
    './fxService': fxService,
    '../../Buyer/models/buyerProductReviewModel': buyerProductReviewModel,
    'algoliasearch': algoliasearch,
    'moment': require('moment'),
    '@hapi/joi': {},
    '../../Buyer/models/buyerSavedItemsModel': buyerSavedItemsModel,
    'validator': { isIn: () => true }
});

const buyerCartService = proxyquire('../src/Buyer/Service/buyerCartService', {
    '../../Buyer/models/buyerCartModel': userCartModel,
    '../../models/productModel': productModel,
    '../helper/dbHelper': mongoDbDataFormat,
    '../constants': constants,
    '../../Buyer/models/guestCartModel': {},
    '../helper/cartFunction': {},
    './fxService': fxService,
    '../../Buyer/models/buyerProductReviewModel': buyerProductReviewModel
});

async function runVerification() {
    console.log('Running Cross-Check Verification...');
    try {
        // 1. Get Saved Items Result
        const savedItemsResult = await buyerSavedItemsService.retrieveBuyerSavedItems('user123');
        const savedItem = savedItemsResult[0];

        // 2. Get Product Result
        const productResult = await buyerProductService.retrieveAllProducts({ limit: 1 });
        const productItem = productResult.products[0];

        // 3. Get Cart Result
        // Hack: mock re-fetch logic in cart service might be tricky, assuming populate works
        const cartResult = await buyerCartService.retrieveUserCart({ userId: 'user123' });
        const cartItem = cartResult.cartItems[0];

        console.log('\n--- Structure Comparison ---');

        const fieldsToCheck = [
            '_id',
            'productName',
            'productPrice',
            'regularPrice',
            'salesPrice',
            'previousPrice',
            'productCategory',
            'productSubcategory',
            'sellerName',
            'productRating',
            'productImages',
            'regularPriceUSD',
            'salesPriceUSD',
            'previousPriceUSD',
            'fxRate'
        ];

        let allMatch = true;

        fieldsToCheck.forEach(field => {
            const savedVal = JSON.stringify(savedItem[field]); // Stringify for array comparison/deep equality check
            const prodVal = JSON.stringify(productItem[field]);
            const cartVal = JSON.stringify(cartItem[field]);

            if (savedVal === prodVal && prodVal === cartVal) {
                console.log(`✅ ${field}: MATCH`);
            } else {
                console.log(`❌ ${field}: MISMATCH`);
                console.log(`   Saved: ${savedVal}`);
                console.log(`   Prod:  ${prodVal}`);
                console.log(`   Cart:  ${cartVal}`);
                allMatch = false;
            }
        });

        if (allMatch) {
            console.log('\n✅ SUCCESS: All 3 services return consistent product structures.');
        } else {
            console.error('\n❌ FAILURE: Structures do not match.');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ VERIFICATION FAILED:', error);
        process.exit(1);
    }
}

runVerification();
