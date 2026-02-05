const proxyquire = require('proxyquire');
const assert = require('assert');

// Mock Redis
let redisStore = {};
const redisMock = {
    get: async (key) => redisStore[key] || null,
    set: async (key, val, mode, ttl) => {
        redisStore[key] = val;
        return 'OK';
    }
};

// Mock Axios for Provider
let providerCalls = 0;
const axiosMock = {
    get: async () => {
        providerCalls++;
        return {
            data: {
                rates: { NGN: 1500 }
            }
        };
    }
};

// Load fxService
const fxService = proxyquire('../src/Buyer/Service/fxService.js', {
    'axios': axiosMock,
    '../../configs/redis': redisMock
});

async function testSWR() {
    console.log('Testing Stale-While-Revalidate (SWR)...');

    // 1. Initial fetch
    console.log('Step 1: Initial fetch');
    const rate1 = await fxService.getFxRateNGNtoUSD();
    assert.strictEqual(providerCalls, 1);

    // 2. Mark as stale
    console.log('Step 2: Serve stale');
    const cacheKey = 'fx_rate_ngn_usd_v2';
    const staleData = JSON.parse(redisStore[cacheKey]);
    staleData.expiresAt = Date.now() - 1000;
    redisStore[cacheKey] = JSON.stringify(staleData);

    const rate2 = await fxService.getFxRateNGNtoUSD();
    assert.strictEqual(rate1, rate2);

    await new Promise(resolve => setTimeout(resolve, 100));
    assert.strictEqual(providerCalls, 2);
    console.log('✅ SWR Test Passed');
}

async function testPermanentFallback() {
    console.log('Testing Permanent Redis Fallback...');

    // Load a FRESH instance of fxService to ensure empty in-memory cache
    const fxServiceFresh = proxyquire('../src/Buyer/Service/fxService.js', {
        'axios': axiosMock,
        '../../configs/redis': redisMock
    });

    const cacheKey = 'fx_rate_ngn_usd_v2';
    const permanentKey = `${cacheKey}_permanent`;

    // Setup permanent key but NO cache key
    redisStore = {};
    redisStore[permanentKey] = '0.0006';

    // Force provider error
    const originalAxios = axiosMock.get;
    axiosMock.get = async () => { throw new Error('Timeout'); };

    console.log('Step: Fetch with empty memory and empty cache, but valid permanent key');
    const rate = await fxServiceFresh.getFxRateNGNtoUSD();
    assert.strictEqual(rate, 0.0006);
    console.log('✅ Permanent Fallback Test Passed');

    axiosMock.get = originalAxios;
}

async function runTests() {
    try {
        await testSWR();
        await testPermanentFallback();
        console.log('\nFX SERVICE RESILIENCY TESTS PASSED! 🚀');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ FX TEST FAILED');
        console.error(err);
        process.exit(1);
    }
}

runTests();
