const proxyquire = require('proxyquire');
const assert = require('assert');

// Mock Data
const MOCK_ADDRESS_ID = 'addr123';
const MOCK_PRODUCT_ID = 'prod123';
const MOCK_BUYER = {
    fullName: 'John Doe',
    email: 'john@example.com',
    phoneNumber: '1234567890',
    deliveryAddresses: {
        id: (id) => {
            if (id === MOCK_ADDRESS_ID) {
                return {
                    _id: MOCK_ADDRESS_ID,
                    postalCode: '10001',
                    cityName: 'New York',
                    countryCode: 'US',
                    address: '123 Test St',
                    countryName: 'United States'
                };
            }
            return null;
        }
    }
};

const MOCK_PRODUCT_MISSING_DETAILS_ID = 'prod456';

const MOCK_PRODUCT = {
    _id: MOCK_PRODUCT_ID,
    productName: 'Test Product',
    weight: '1.5',
    dimensions: {
        length: 10,
        width: 10,
        height: 5
    },
    toString: () => MOCK_PRODUCT_ID
};

const MOCK_PRODUCT_MISSING_DETAILS = {
    _id: MOCK_PRODUCT_MISSING_DETAILS_ID,
    productName: 'Incomplete Product',
    toString: () => MOCK_PRODUCT_MISSING_DETAILS_ID
};

// Mock Models
const BuyerMock = {
    findOne: async (query) => {
        console.log('Mock Buyer.findOne called with:', query);
        if (query['deliveryAddresses._id'] === MOCK_ADDRESS_ID) {
            return MOCK_BUYER;
        }
        return null;
    }
};

const ProductMock = {
    Product: {
        find: async (query) => {
            console.log('Mock Product.find called with:', query);
            // Find matching products
            const results = [];
            if (query._id && query._id.$in) {
                if (query._id.$in.includes(MOCK_PRODUCT_ID)) results.push(MOCK_PRODUCT);
                if (query._id.$in.includes(MOCK_PRODUCT_MISSING_DETAILS_ID)) results.push(MOCK_PRODUCT_MISSING_DETAILS);
            }
            return results;
        }
    }
};

// Mock Services
const buyerDHLServiceMock = {
    getDeliveryRate: async (params) => {
        console.log('Mock getDeliveryRate called with:', params);

        try {
            // Shipper assertions (should be normalized to "Lagos")
            assert.strictEqual(params.shipperDetails.cityName, 'Lagos', 'Shipper City Name should be normalized to Lagos');
            assert.strictEqual(params.shipperDetails.postalCode, '100216', 'Shipper Postal Code mismatch');

            // Receiver assertions
            // assert.strictEqual(params.receiverDetails.contactInformation.fullName, 'John Doe'); // Contact info removed
            assert.strictEqual(params.receiverDetails.postalCode, '10001');
            assert.strictEqual(params.receiverDetails.addressLine1, '123 Test St');
            assert.strictEqual(params.receiverDetails.countryCode, 'US');

            // Package assertions
            // We expect 3 packages total: 2 from normal product, 1 from incomplete product
            assert.strictEqual(params.packages.length, 3);

            // First 2 are from normal product (ordered by how items iteration happens, but here let's just check contents)
            const normalPackages = params.packages.filter(p => p.weight === 1.5);
            assert.strictEqual(normalPackages.length, 2);
            assert.strictEqual(normalPackages[0].dimensions.height, 5);

            // 1 package from incomplete product (should use defaults)
            const defaultPackages = params.packages.filter(p => p.weight === 0.5);
            assert.strictEqual(defaultPackages.length, 1);
            assert.strictEqual(defaultPackages[0].dimensions.length, 10);
            assert.strictEqual(defaultPackages[0].dimensions.width, 10);
            assert.strictEqual(defaultPackages[0].dimensions.height, 5);

            console.log('VERIFICATION SUCCESS: Service called with correct DB-mapped data and defaults applied.');
        } catch (error) {
            console.error('VERIFICATION FAILED:', error.message);
            process.exit(1);
        }

        return {
            currency: 'NGN',
            totalPrice: 20000,
            totalPriceUSD: 13.33
        };
    },
    validateAddress: async () => { }
};

const fxServiceMock = {
    convertNGNtoUSD: async (val) => val / 1500
};

// Load Controller
const buyerDHLController = proxyquire('../src/Buyer/controllers/buyerDHLController.js', {
    '../Service/buyerDHLService': buyerDHLServiceMock,
    '../Service/fxService': fxServiceMock,
    '../models/buyerAuthModel': BuyerMock,
    '../../models/productModel': ProductMock,
    '../constants': {
        customServerResponse: {},
        shippingRateMessages: { RATE_RETRIEVED: 'Rate Retrieved' }
    },
    '../apiSchema/buyerDHLSchema': { getDHLPickupSchema: {} }
});

// Run Test
const req = {
    body: {
        addressId: MOCK_ADDRESS_ID,
        items: [
            { productId: MOCK_PRODUCT_ID, quantity: 2 },
            { productId: MOCK_PRODUCT_MISSING_DETAILS_ID, quantity: 1 }
        ]
    }
};

const res = {
    status: (code) => ({
        json: (data) => console.log(`Response ${code}:`, data),
        send: (data) => console.log(`Response ${code}:`, data)
    })
};

console.log('Running DB Refactor Verification...');
buyerDHLController.getDHLRate(req, res);
