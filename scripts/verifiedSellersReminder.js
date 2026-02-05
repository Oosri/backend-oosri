const path = require('path');
const dotenv = require('dotenv');

// Load environment variables at the very beginning
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const fs = require('fs');
const dbConnect = require('../src/configs/database');
const Seller = require('../src/models/sellerModel');
const { Product } = require('../src/models/productModel');
const { sendReminderEmail } = require('../src/utils/emailService');

const loadTemplate = (templateName) => {
    const filePath = path.join(__dirname, 'templates', templateName);
    return fs.readFileSync(filePath, 'utf8');
};

const replacePlaceholders = (template, placeholders) => {
    return template.replace(/{{\s*(\w+)\s*}}/g, (match, key) => {
        return placeholders[key] !== undefined ? placeholders[key] : match;
    });
};

const run = async () => {
    try {
        console.log('🚀 Starting Verified Sellers Reminder Script...');
        await dbConnect();

        // 1. Fetch verified sellers who have no products
        // We can optimize by querying for verified sellers first
        const verifiedSellers = await Seller.find({
            $or: [
                { isVerified: true },
                { sellerStatus: 'Verified' }
            ]
        });

        console.log(`Found ${verifiedSellers.length} verified sellers.`);

        let reminderCount = 0;

        for (const seller of verifiedSellers) {
            // 2. Check if seller has any products
            const productCount = await Product.countDocuments({ seller: seller._id });

            if (productCount === 0) {
                console.log(`Verified Seller ${seller.email} has no products. Sending "Welcome & Upload" reminder...`);

                // 3. Prepare email
                const template = loadTemplate('verifiedReminderTemplate2.html');
                const htmlContent = replacePlaceholders(template, {
                    sellerName: `${seller.firstName} ${seller.lastName}`
                });

                // 4. Send email
                try {
                    await sendReminderEmail(
                        seller.email,
                        'Welcome to Oosri! Your Store is Verified & Live',
                        htmlContent,
                        `${seller.firstName} ${seller.lastName}`
                    );
                    reminderCount++;
                    console.log(`✅ Verified reminder sent to ${seller.email}`);
                } catch (emailError) {
                    console.error(`❌ Failed to send email to ${seller.email}:`, emailError.message);
                }
            } else {
                console.log(`Verified Seller ${seller.email} has products. Skipping.`);
            }
        }

        console.log(`🏁 Script finished. Sent ${reminderCount} verified reminders.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }
};

run();
