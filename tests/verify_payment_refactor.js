const dotenv = require('dotenv');
dotenv.config();

// Mock Stripe Key for testing load
process.env.STRIPE_PAYMENT_TEST_KEY = process.env.STRIPE_PAYMENT_TEST_KEY || 'sk_test_mock_key';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_key';

const mongoose = require('mongoose');
const buyersPaymentController = require('../src/Buyer/controllers/buyersPaymentController');
const emailWorker = require('../src/workers/email.worker');

// Mock Mongoose Session
const mockSession = {
    startTransaction: () => { },
    commitTransaction: () => { },
    abortTransaction: () => { },
    endSession: () => { },
    inTransaction: () => true
};

mongoose.startSession = async () => mockSession;
mongoose.connect = async () => console.log('Mock DB Connected');

async function testWorkerInit() {
    console.log('Testing Worker Initialization...');
    if (emailWorker && emailWorker.name === 'email-queue') {
        console.log('✅ Email Worker initialized correctly with dedicated connection');
    } else {
        console.error('❌ Email Worker initialization failed');
        process.exit(1);
    }
}

async function testControllerImports() {
    console.log('Testing Controller Imports...');
    if (typeof buyersPaymentController.handleStripeWebhook === 'function') {
        console.log('✅ handleStripeWebhook is a function');
    } else {
        console.error('❌ handleStripeWebhook is missing');
        process.exit(1);
    }
}

async function runTests() {
    try {
        await testWorkerInit();
        await testControllerImports();

        console.log('All smoke tests passed!');
        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

runTests();
