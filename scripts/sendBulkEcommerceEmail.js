const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbConnect = require('../src/configs/database');
const Seller = require('../src/models/sellerModel');
const { sendReminderEmail } = require('../src/utils/emailService');

const loadTemplate = (templateName) => {
    const filePath = path.join(__dirname, 'templates', templateName);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Template file not found at ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.trim()) {
        console.warn(`⚠️ Warning: Template ${templateName} is empty!`);
    }
    return content;
};

const replacePlaceholders = (template, placeholders) => {
    return template.replace(/{{?\s*(\w+)\s*}}?/g, (match, key) => {
        return placeholders[key] !== undefined ? placeholders[key] : match;
    });
};

const run = async () => {
    try {
        console.log('🚀 Starting Bulk Ecommerce Email Script...');
        await dbConnect();

        // 1. Fetch all sellers (No limit as per user request for staging testing)
        const sellers = await Seller.find({});
        console.log(`Found ${sellers.length} sellers in total.`);

        if (sellers.length === 0) {
            console.log('No sellers found. Exiting.');
            process.exit(0);
        }

        // 2. Load template
        const template = loadTemplate('ecommerceNewTemp.html');

        let sentCount = 0;
        let failCount = 0;

        for (const seller of sellers) {
            console.log(`Sending email to ${seller.email}...`);

            // 3. Prepare placeholders
            const placeholders = {
                seller_name: seller.firstName || 'Seller',
                firstName: seller.firstName || 'Seller',
                lastName: seller.lastName || '',
                email: seller.email
            };

            const htmlContent = replacePlaceholders(template, placeholders);

            // 4. Send email
            try {
                // Using sendReminderEmail utility (which uses ZeptoMail as per emailService.js)
                await sendReminderEmail(
                    seller.email,
                    'Stop Wasting Your Time',
                    htmlContent,
                    `${seller.firstName} ${seller.lastName}`
                );
                sentCount++;
                console.log(`✅ Email sent to ${seller.email}`);
            } catch (emailError) {
                failCount++;
                console.error(`❌ Failed to send email to ${seller.email}:`, emailError.message);
            }
        }

        console.log(`🏁 Batch process finished.`);
        console.log(`Successful: ${sentCount}`);
        console.log(`Failed: ${failCount}`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }
};

run();
