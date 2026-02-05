
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');
require('dotenv').config();

const BASE_URL = 'http://localhost:8000/api/v1'; // Adjust port if needed

async function runTest() {
    console.log('🚀 Starting Product Upload Test...');

    // 1. Login as Seller
    let token;
    try {
        const loginRes = await axios.post(`${BASE_URL}/auth/seller/sign-in`, {
            email: process.env.TEST_SELLER_EMAIL || 'test_seller@oosri.com',
            password: process.env.TEST_SELLER_PASSWORD || 'password123'
        });
        token = loginRes.data.token;
        console.log('✅ Seller Logged In');
    } catch (err) {
        console.error('❌ Login Failed:', err.response?.data || err.message);
        return;
    }

    // 2. Prepare Images
    const dummyImagePath = path.join(__dirname, 'test_image.jpg');
    if (!fs.existsSync(dummyImagePath)) {
        // Create a dummy file if not exists
        fs.writeFileSync(dummyImagePath, 'dummy content'); // Ideally this should be a real binary img
    }

    // We need a real image or the validation might fail (multer file validation)
    // For now assuming test_image.jpg exists or we create a valid one
    // Let's rely on a utility to create a minimal valid JPG if missing? 
    // Or just fail if not present.
    // Better: Write a minimal valid JPG buffer.
    const validJpgBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb
    ]); // Incomplete but might pass magic number check if header is enough. 
    // Actually validation uses path.extname and magic numbers often.
    fs.writeFileSync(dummyImagePath, validJpgBuffer);

    // 2.5 Get Category
    let categoryId;
    try {
        const catRes = await axios.get(`${BASE_URL}/categories`);
        // catRes.data structure: { status: 200, success: true, message: '...', data: [...] }
        const categories = catRes.data.data || catRes.data.body || catRes.data;
        if (categories && categories.length > 0) {
            categoryId = categories[0]._id;
            console.log(`✅ Using Category ID: ${categoryId}`);
        } else {
            console.error('❌ No categories found!');
            return;
        }
    } catch (err) {
        console.error('❌ Failed to fetch categories:', err.message);
        return;
    }

    // 3. Upload Product
    const form = new FormData();
    form.append('name', 'Test Product ' + Date.now());
    form.append('description', 'This is a test product for upload optimization verification');
    form.append('price', 1000);
    form.append('category', categoryId);
    form.append('countInStock', 10);
    form.append('brandArtist', 'Test Artist');
    form.append('images', fs.createReadStream(dummyImagePath));
    form.append('images', fs.createReadStream(dummyImagePath));
    form.append('images', fs.createReadStream(dummyImagePath));

    const start = Date.now();
    try {
        const uploadRes = await axios.post(`${BASE_URL}/products/seller/add`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${token}`
            }
        });
        const duration = Date.now() - start;
        console.log(`✅ Product Uploaded Successfully!`);
        console.log(`⏱️ Time Taken: ${duration}ms`);
        console.log('Response:', uploadRes.data);
    } catch (err) {
        console.error('❌ Upload Failed:', err.response?.data || err.message);
    }
}

runTest();
