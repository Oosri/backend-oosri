require('dotenv').config();
const mongoose = require('mongoose');
const Seller = require('../src/models/sellerModel');
const { uploadSellerDocument } = require('../src/utils/cloudinary');
const fs = require('fs');
const path = require('path');

const SELLER_ID = '6970e2034b971ea8415bfde4';

async function testWorkerLogic() {
    try {
        console.log('Testing worker logic manually...\n');

        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB\n');

        // Simulate what the worker does
        const file = {
            path: '/tmp/test-vat.pdf',
            originalname: 'vat-certificate.pdf',
            mimetype: 'application/pdf',
            size: 50000
        };

        console.log('Checking if file exists:', file.path);
        const fileExists = fs.existsSync(file.path);
        console.log('File exists:', fileExists);

        if (!fileExists) {
            console.log('\n❌ THIS IS THE PROBLEM!');
            console.log('The worker is trying to upload files that don\'t exist.');
            console.log('\nWhen you made the business registration request:');
            console.log('1. Multer saved the uploaded files to temporary paths');
            console.log('2. The controller queued jobs with those paths');
            console.log('3. But by the time the worker processed them, the files were gone\n');
            console.log('SOLUTION: The files need to persist until the worker processes them.');
        } else {
            console.log('\n✅ File exists, attempting upload...');
            try {
                const documentUrl = await uploadSellerDocument(file, 'vat_cert', SELLER_ID);
                console.log('Upload successful!');
                console.log('URL:', documentUrl);
            } catch (uploadError) {
                console.error('Upload failed:', uploadError.message);
            }
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

testWorkerLogic();
