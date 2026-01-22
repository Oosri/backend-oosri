require('dotenv').config();
const mongoose = require('mongoose');
const Seller = require('../src/models/sellerModel');

const SELLER_ID = '6970e2034b971ea8415bfde4';

async function verifyDocumentUpload() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB\n');

        const seller = await Seller.findById(SELLER_ID);

        if (!seller) {
            console.log('❌ Seller not found');
            process.exit(1);
        }

        console.log('=== Seller Document Upload Status ===\n');
        console.log(`Seller: ${seller.firstName} ${seller.lastName}`);
        console.log(`Email: ${seller.email}`);
        console.log(`Business Type: ${seller.businessType}\n`);

        if (seller.businessType === 'Corporate') {
            console.log('--- Corporate Business Account ---');
            console.log(`Company Name: ${seller.corporateBusinessAccount?.companyName || 'N/A'}`);
            console.log(`\nVAT Certificate:`);
            console.log(`  Status: ${seller.corporateBusinessAccount?.vatCertificate === 'pending' ? '⏳ PENDING' : '✅ UPLOADED'}`);
            console.log(`  URL: ${seller.corporateBusinessAccount?.vatCertificate || 'N/A'}`);
            console.log(`\nCompany Certificate:`);
            console.log(`  Status: ${seller.corporateBusinessAccount?.companyCertificate === 'pending' ? '⏳ PENDING' : '✅ UPLOADED'}`);
            console.log(`  URL: ${seller.corporateBusinessAccount?.companyCertificate || 'N/A'}`);
        } else if (seller.businessType === 'Personal') {
            console.log('--- Personal Business Account ---');
            console.log(`\nCountry ID Card:`);
            console.log(`  Status: ${seller.personalBusinessAccount?.countryIdentificationCard === 'pending' ? '⏳ PENDING' : '✅ UPLOADED'}`);
            console.log(`  URL: ${seller.personalBusinessAccount?.countryIdentificationCard || 'N/A'}`);
        }

        console.log(`\n--- Profile Picture ---`);
        console.log(`Status: ${seller.profilePicture.includes('Avatar') ? '📸 Using Avatar' : '✅ UPLOADED'}`);
        console.log(`URL: ${seller.profilePicture}`);

        console.log(`\n--- Timestamps ---`);
        console.log(`Created: ${seller.createdAt}`);
        console.log(`Updated: ${seller.updatedAt}`);

        await mongoose.connection.close();
        console.log('\n✅ Verification complete');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

verifyDocumentUpload();
