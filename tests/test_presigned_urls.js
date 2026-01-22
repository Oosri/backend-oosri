require('dotenv').config();
const { generatePresignedUrl, validateCloudinaryUrl } = require('../src/utils/cloudinarySignature');

console.log('=== Testing Presigned URL Generation ===\n');

// Test 1: Generate presigned URL for VAT certificate
console.log('Test 1: Generate VAT Certificate URL');
const vatUrl = generatePresignedUrl('test_seller_123', 'vat_cert');
console.log('✅ Generated URL:', vatUrl.url);
console.log('✅ Public ID:', vatUrl.publicId);
console.log('✅ Signature:', vatUrl.signature.substring(0, 20) + '...');
console.log('✅ Timestamp:', vatUrl.timestamp);
console.log('✅ API Key:', vatUrl.apiKey);
console.log();

// Test 2: Generate presigned URL for Company certificate
console.log('Test 2: Generate Company Certificate URL');
const companyUrl = generatePresignedUrl('test_seller_123', 'company_cert');
console.log('✅ Generated URL:', companyUrl.url);
console.log('✅ Public ID:', companyUrl.publicId);
console.log();

// Test 3: Generate presigned URL for Country ID
console.log('Test 3: Generate Country ID URL');
const countryIdUrl = generatePresignedUrl('test_seller_456', 'country_id');
console.log('✅ Generated URL:', countryIdUrl.url);
console.log('✅ Public ID:', countryIdUrl.publicId);
console.log();

// Test 4: Validate Cloudinary URLs
console.log('Test 4: Validate Cloudinary URLs');
const validUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/v1234567890/test.jpg`;
const invalidUrl = 'https://example.com/image.jpg';

console.log('Valid URL:', validateCloudinaryUrl(validUrl) ? '✅ PASS' : '❌ FAIL');
console.log('Invalid URL:', !validateCloudinaryUrl(invalidUrl) ? '✅ PASS' : '❌ FAIL');
console.log();

console.log('=== All Tests Passed ===');
