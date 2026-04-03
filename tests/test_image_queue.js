require('dotenv').config();
const { addImageJob } = require('../src/queues/image.queue');

async function testImageQueue() {
    try {
        console.log('Testing image queue...\n');

        // Test adding a seller-document job
        await addImageJob('seller-document', {
            sellerId: '6970e2034b971ea8415bfde4',
            file: {
                path: '/tmp/test-vat-cert.pdf',
                originalname: 'vat-cert.pdf',
                mimetype: 'application/pdf',
                size: 12345
            },
            documentType: 'vat_cert',
            businessType: 'Corporate',
            fieldName: 'vatCertificate'
        });

        console.log('✅ Successfully added test job to image queue');
        console.log('Check the queue status again with: node tests/check_queue_status.js');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding job to queue:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testImageQueue();
