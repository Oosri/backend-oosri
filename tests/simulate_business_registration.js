require('dotenv').config();
const { addImageJob } = require('../src/queues/image.queue');

async function simulateBusinessRegistration() {
    try {
        console.log('Simulating business registration document upload...\n');

        const sellerId = '6970e2034b971ea8415bfde4';
        const files = {
            'vatCertificate': [{
                path: '/tmp/test-vat.pdf',
                originalname: 'vat-certificate.pdf',
                mimetype: 'application/pdf',
                size: 50000
            }],
            'companyCertificate': [{
                path: '/tmp/test-company.pdf',
                originalname: 'company-certificate.pdf',
                mimetype: 'application/pdf',
                size: 60000
            }]
        };

        console.log('Adding VAT Certificate job...');
        await addImageJob('seller-document', {
            sellerId: sellerId,
            file: {
                path: files['vatCertificate'][0].path,
                originalname: files['vatCertificate'][0].originalname,
                mimetype: files['vatCertificate'][0].mimetype,
                size: files['vatCertificate'][0].size
            },
            documentType: 'vat_cert',
            businessType: 'Corporate',
            fieldName: 'vatCertificate'
        });
        console.log('✅ VAT Certificate job added');

        console.log('\nAdding Company Certificate job...');
        await addImageJob('seller-document', {
            sellerId: sellerId,
            file: {
                path: files['companyCertificate'][0].path,
                originalname: files['companyCertificate'][0].originalname,
                mimetype: files['companyCertificate'][0].mimetype,
                size: files['companyCertificate'][0].size
            },
            documentType: 'company_cert',
            businessType: 'Corporate',
            fieldName: 'companyCertificate'
        });
        console.log('✅ Company Certificate job added');

        console.log('\n✅ Both jobs added successfully!');
        console.log('Wait a few seconds, then check: node tests/verify_document_upload.js');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

simulateBusinessRegistration();
