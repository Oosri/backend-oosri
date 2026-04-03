require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TOKEN = process.env.TEST_SELLER_TOKEN; // Set this in .env

async function testBusinessRegistrationFlow() {
    console.log('=== Testing Business Registration with Presigned URLs ===\n');

    if (!TOKEN) {
        console.error('❌ TEST_SELLER_TOKEN not set in .env');
        console.log('Please set TEST_SELLER_TOKEN with a valid seller JWT token');
        return;
    }

    try {
        // Step 1: Request presigned URLs
        console.log('Step 1: Requesting presigned URLs...');
        const urlResponse = await axios.post(
            `${BASE_URL}/api/v1/auth/seller/get-document-upload-urls`,
            {
                businessType: 'Corporate',
                documents: ['vatCertificate', 'companyCertificate']
            },
            {
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Received upload URLs');
        const { uploadUrls } = urlResponse.data;
        console.log('VAT Certificate Public ID:', uploadUrls.vatCertificate.publicId);
        console.log('Company Certificate Public ID:', uploadUrls.companyCertificate.publicId);
        console.log();

        // Step 2: Upload files to Cloudinary (simulated - you would do this from frontend)
        console.log('Step 2: Uploading files to Cloudinary...');
        console.log('⚠️  This step requires actual files to upload');
        console.log('In production, frontend would upload files using the presigned URLs');
        console.log();

        // For testing, you can manually upload files using the URLs
        console.log('Upload URL for VAT:', uploadUrls.vatCertificate.url);
        console.log('Upload URL for Company:', uploadUrls.companyCertificate.url);
        console.log();

        // Step 3: Complete business registration with URLs
        console.log('Step 3: Completing business registration...');
        console.log('⚠️  This step requires actual Cloudinary URLs from uploaded files');
        console.log('Example request body:');
        console.log(JSON.stringify({
            bankDetails: {
                bank: 'Test Bank',
                accountName: 'Test Account',
                accountNumber: '1234567890'
            },
            companyName: 'Test Company',
            companyAddress: 'Test Address',
            vatNumber: 'VAT123456',
            companyRegNum: 'REG123456',
            paymentMethod: 'Transfer',
            vatCertificateUrl: 'https://res.cloudinary.com/YOUR_CLOUD/...',
            companyCertificateUrl: 'https://res.cloudinary.com/YOUR_CLOUD/...'
        }, null, 2));
        console.log();

        console.log('=== Test Flow Complete ===');
        console.log('✅ Presigned URL generation works');
        console.log('⚠️  Manual upload and registration completion required');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testBusinessRegistrationFlow();
