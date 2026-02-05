require('dotenv').config();
const buyerDHLService = require('../src/Buyer/Service/buyerDHLService');

async function testDHLConfig() {
    console.log('Testing DHL Configuration Initialization...');
    console.log('Environment Variables:');
    console.log('- DHL_API_BASE_URL:', process.env.DHL_API_BASE_URL);

    try {
        // We don't need valid credentials to test URL construction
        // It should throw a 401 OR a validation error, but NOT "Invalid URL"
        console.log('\nTesting validateAddress URL construction...');
        await buyerDHLService.validateAddress({
            countryCode: 'NG',
            cityName: 'Lagos',
            postalCode: '100216'
        });
    } catch (error) {
        console.log('Caught Expected Error:', error.message);
        if (error.message.includes('Invalid URL')) {
            console.error('❌ FAIL: Still getting Invalid URL error!');
            process.exit(1);
        } else {
            console.log('✅ PASS: No "Invalid URL" error. URL construction is working.');
        }
    }
}

testDHLConfig();
