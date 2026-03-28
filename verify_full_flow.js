require('dotenv').config();
const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const { Category } = require('./src/models/categoryModel');
const { Product } = require('./src/models/productModel');
const { Attribute } = require('./src/models/attributeModel');
const categoryController = require('./src/controllers/categoryController');
const productController = require('./src/controllers/productController');
const { sellerAuth, verifySeller } = require('./src/middlewares/auth.middleware');

// Mock Auth Middleware
const mockAuth = (req, res, next) => {
    req.seller = { _id: new mongoose.Types.ObjectId(), isVerified: true };
    next();
};


const app = express();
app.use(bodyParser.json());

// Routes
app.get('/api/v1/categories', categoryController.getCategories);
app.post('/api/v1/products/add', mockAuth, productController.createProduct);
app.get('/api/v1/products/seller/:id', productController.getProductById);

const runVerification = async () => {
    try {
        const dbUrl = process.env.MONGO_URI || process.env.MONGO_URI_DEV;
        await mongoose.connect(dbUrl);
        console.log('Connected to DB');

        // 1. Test getCategories
        console.log('\n1. Testing GET /categories...');
        const catRes = await request(app).get('/api/v1/categories');
        if (catRes.status !== 200) {
            console.error('GetCategories Body:', JSON.stringify(catRes.body, null, 2));
            throw new Error(`GetCategories failed: ${catRes.status}`);
        }

        // Find 'Sculpture' category
        const sculptureCat = catRes.body.data.find(c => c.name === 'Sculpture');
        if (!sculptureCat) throw new Error('Sculpture category not found');
        console.log('  - Found Sculpture category');

        // Verify attributes are populated
        if (!sculptureCat.attributes || sculptureCat.attributes.length === 0) {
            throw new Error('Attributes NOT populated in category');
        }
        console.log('  - Attributes populated:', sculptureCat.attributes.map(a => a.details?.code || a.code));

        // 2. Test createProduct with dynamic attributes
        console.log('\n2. Testing CREATE Product...');
        const payload = {
            productName: "Dynamic Sculpture 001",
            productDescription: "A test sculpture",
            regularPrice: 1000,
            salesPrice: 900,
            productType: "simple",
            brandArtist: "Test Artist",
            category: sculptureCat._id, // Send ID
            images: [`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/sample.jpg`],
            attributes: {
                height: 150,
                width: 50,
                technique: "Bronze Casting"
            }
        };

        const createRes = await request(app).post('/api/v1/products/add').send(payload);
        if (createRes.status !== 201) {
            console.error('Create failed:', createRes.body);
            throw new Error(`CreateProduct failed: ${createRes.status}`);
        }
        const productId = createRes.body.data._id;
        console.log(`  - Created product: ${productId}`);

        // 3. Test getProductById
        console.log('\n3. Testing GET Product...');
        const getRes = await request(app).get(`/api/v1/products/seller/${productId}`);
        if (getRes.status !== 200) {
            console.error('Get failed:', getRes.body);
            throw new Error(`GetProduct failed: ${getRes.status}`);
        }

        const product = getRes.body.data; // or data.data depending on controller structure
        // Check if category is populated
        if (!product.category || !product.category.attributes) {
            console.log('Product Category:', product.category);
            throw new Error('Product Category NOT populated correctly');
        }
        console.log('  - Product category populated with attributes');

        // Check attributes map
        if (product.attributes.height !== 150) {
            throw new Error(`Attribute mismatch. Expected 150, got ${product.attributes.height}`);
        }
        console.log('  - Product attributes saved correctly:', product.attributes);

        console.log('\nSUCCESS: Full flow verified!');

        // Cleanup
        await Product.deleteOne({ _id: productId });
        console.log('Cleanup complete');
        process.exit(0);

    } catch (err) {
        console.error('\nVerification FAILED:', err);
        process.exit(1);
    }
};

runVerification();
