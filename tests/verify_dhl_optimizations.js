const proxyquire = require('proxyquire');
const assert = require('assert');
const crypto = require('crypto');

// Mock data
const mockAddressId = '65a0c1234567890123456789';
const mockProduct1 = {
    _id: 'prod1',
    weight: 10,
    dimensions: { length: 40, width: 40, height: 40 } // Vol: 64,000
};
const mockProductLargeLight = {
    _id: 'prod_large',
    weight: 1,
    dimensions: { length: 100, width: 100, height: 100 } // Vol: 1,000,000 (exceeds 250,000)
};

const mockBuyer = {
    deliveryAddresses: {
        id: (id) => ({
            _id: id,
            cityName: 'Agege',
            countryCode: 'NG',
            postalCode: '100283',
            regionName: 'Lagos State'
        })
    }
};

// Mock Response
const createRes = () => {
    const res = {
        status: (code) => {
            res.statusCode = code;
            return res;
        },
        json: (body) => {
            res.body = body;
            return res;
        }
    };
    return res;
};

// Mocks
let lastBuyerQuery = null;
const buyerModelMock = {
    findOne: async (query, projection) => {
        lastBuyerQuery = { query, projection };
        return mockBuyer;
    }
};

const productModelMock = {
    find: async () => [mockProduct1, mockProductLargeLight]
};

const redisMock = {
    get: async () => null,
    set: async () => 'OK'
};

const buyerDHLServiceMock = {
    getDeliveryRate: async (params) => {
        // Verification of timezone
        assert.ok(params.plannedShippingDateAndTime.includes('GMT+01:00'), 'Timezone format invalid');

        return {
            product: 'Express',
            totalPrice: 10000,
            currency: 'NGN'
        };
    }
};

const fxServiceMock = {
    getFxRateNGNtoUSD: async () => 1 / 1500,
    convertNGNtoUSD: async (val) => val / 1500
};

const constantsMock = {
    customServerResponse: { status: 0, message: '', body: {} },
    shippingRateMessages: { RATE_RETRIEVED: 'Success' }
};

// Load controller
const controller = proxyquire('../src/Buyer/controllers/buyerDHLController.js', {
    '../Service/buyerDHLService': buyerDHLServiceMock,
    '../Service/fxService': fxServiceMock,
    '../constants': constantsMock,
    '../models/buyerAuthModel': buyerModelMock,
    '../../models/productModel': { Product: productModelMock },
    '../../configs/redis': redisMock
});

async function testVolumetricPacking() {
    console.log('Testing Volumetric Packing...');
    const req = {
        body: {
            addressId: mockAddressId,
            items: [
                { productId: 'prod_large', quantity: 1 }
            ]
        }
    };
    const res = createRes();

    const originalGetRate = buyerDHLServiceMock.getDeliveryRate;
    buyerDHLServiceMock.getDeliveryRate = async (params) => {
        assert.strictEqual(params.packages.length, 1, 'Should have 1 package for 1 large item');
        return { product: 'Express', totalPrice: 10000, currency: 'NGN' };
    };

    await controller.getDHLRate(req, res);
    console.log('✅ Volumetric Packing Test Passed');
    buyerDHLServiceMock.getDeliveryRate = originalGetRate;
}

async function testMD5Hashing() {
    console.log('Testing MD5 Hashing for Redis keys...');
    const req = {
        body: {
            addressId: mockAddressId,
            items: [{ productId: 'prod1', quantity: 1 }]
        }
    };
    const res = createRes();

    let capturedKey = null;
    const originalRedisGet = redisMock.get;
    redisMock.get = async (key) => {
        capturedKey = key;
        return null;
    };

    await controller.getDHLRate(req, res);

    const parts = capturedKey.split(':');
    const hash = parts[parts.length - 1];
    assert.strictEqual(hash.length, 32, 'Hash should be 32 chars (MD5)');
    console.log('✅ MD5 Hashing Test Passed');

    redisMock.get = originalRedisGet;
}

async function testMongoProjection() {
    console.log('Testing MongoDB Projection...');
    const req = {
        body: {
            addressId: mockAddressId,
            items: [{ productId: 'prod1', quantity: 1 }]
        }
    };
    const res = createRes();

    await controller.getDHLRate(req, res);

    assert.deepStrictEqual(lastBuyerQuery.projection, { 'deliveryAddresses.$': 1 }, 'Projection failed');
    console.log('✅ MongoDB Projection Test Passed');
}

async function testCrossRateLogic() {
    console.log('Testing Cross-Rate Logic (EUR -> USD)...');
    const req = {
        body: {
            addressId: mockAddressId,
            items: [{ productId: 'prod1', quantity: 1 }]
        }
    };
    const res = createRes();

    const originalGetRate = buyerDHLServiceMock.getDeliveryRate;
    buyerDHLServiceMock.getDeliveryRate = async (params) => {
        return {
            product: 'Express',
            totalPrice: 15000,
            currency: 'NGN',
            exchangeRate: { from: 'EUR', to: 'NGN', rate: 0.0005 } // 1 NGN = 0.0005 EUR
        };
    };

    await controller.getDHLRate(req, res);

    assert.strictEqual(res.body.body.exchangeRate.from, 'EUR');
    assert.strictEqual(res.body.body.exchangeRate.to, 'USD');
    assert.strictEqual(res.body.body.exchangeRate.rate, 1.333333);
    assert.strictEqual(res.body.body.totalPriceUSD, 11.5); // (15000/1500) + 1.5

    console.log('✅ Cross-Rate Logic Test Passed');
    buyerDHLServiceMock.getDeliveryRate = originalGetRate;
}

async function runTests() {
    try {
        await testVolumetricPacking();
        await testMD5Hashing();
        await testMongoProjection();
        await testCrossRateLogic();
        console.log('\nALL TESTS PASSED! 🚀');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ TEST FAILED');
        console.error(err);
        process.exit(1);
    }
}

runTests();
