const dotEnv = require('dotenv');
dotEnv.config();
const { testCloudinaryConnection } = require('./src/utils/cloudinary');

async function runTest() {
    console.log('Starting Cloudinary connection test...');
    const result = await testCloudinaryConnection();
    console.log('Test result:', result);
    process.exit(result ? 0 : 1);
}

runTest();
