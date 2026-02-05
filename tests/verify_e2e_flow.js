require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:5000/api/v1';
const TOKEN = process.env.TEST_SELLER_TOKEN;

async function verifyEndToEndFlow() {
    console.log('🚀 Starting End-to-End Verification of Presigned URL Flow...\n');

    if (!TOKEN) {
        console.error('❌ Set TEST_SELLER_TOKEN in your .env to run this test.');
        return;
    }

    try {
        // 1. Get Presigned URLs
        console.log('Step 1: Requesting presigned URLs from backend...');
        const urlResponse = await axios.post(
            `${BASE_URL}/auth/seller/get-document-upload-urls`,
            {
                businessType: 'Corporate',
                documents: ['vatCertificate', 'companyCertificate']
            },
            { headers: { 'Authorization': `Bearer ${TOKEN}` } }
        );

        const { uploadUrls } = urlResponse.data;
        console.log('✅ Received upload signatures\n');

        // 2. Simulate Frontend Uploading directly to Cloudinary
        console.log('Step 2: Simulating direct upload to Cloudinary (using signatures)...');

        const uploadToCloudinary = async (config, label) => {
            const formData = new FormData();
            // Using a dummy text file to simulate the upload
            formData.append('file', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
            formData.append('api_key', config.apiKey);
            formData.append('timestamp', config.timestamp);
            formData.append('signature', config.signature);
            formData.append('public_id', config.publicId);
            formData.append('folder', config.folder);

            const res = await axios.post(config.url, formData, {
                headers: { ...formData.getHeaders() }
            });
            console.log(`✅ ${label} uploaded: ${res.data.secure_url}`);
            return res.data.secure_url;
        };

        const vatUrl = await uploadToCloudinary(uploadUrls.vatCertificate, 'VAT Certificate');
        const companyUrl = await uploadToCloudinary(uploadUrls.companyCertificate, 'Company Certificate');
        console.log();

        // 3. Submit Final Registration
        console.log('Step 3: Submitting registration with Cloudinary URLs...');
        const regResponse = await axios.post(
            `${BASE_URL}/auth/seller/business-registration`,
            {
                bankDetails: {
                    bank: 'Test Bank',
                    accountName: 'Test Account',
                    accountNumber: '1234567890'
                },
                companyName: 'Test Corp',
                companyAddress: '123 Test St',
                vatNumber: 'VAT123',
                companyRegNum: 'REG123',
                paymentMethod: 'Transfer',
                vatCertificateUrl: vatUrl,
                companyCertificateUrl: companyUrl
            },
            { headers: { 'Authorization': `Bearer ${TOKEN}` } }
        );

        console.log('✅ Registration Submission:', regResponse.data.message);
        console.log('\n✨ END-TO-END FLOW VERIFIED SUCCESSFULLY! ✨');

    } catch (error) {
        console.error('❌ Verification failed!');
        if (error.response) {
            console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error Message:', error.message);
        }
    }
}

verifyEndToEndFlow();
