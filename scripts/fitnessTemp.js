const path = require('path');
const dotenv = require('dotenv');

// Load environment variables at the very beginning
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const fs = require('fs');
const dbConnect = require('../src/configs/database');
const Seller = require('../src/models/sellerModel');
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
        console.log('🚀 Starting Existing Sellers Reminder Script...');
        await dbConnect();

        // 1. Fetch all sellers
        const sellers = await Seller.find({});
        console.log(`Found ${sellers.length} sellers in total.`);

        let reminderCount = 0;

        for (const seller of sellers) {
            console.log(`Sending reminder to ${seller.email}...`);

            // 3. Prepare email
            const template = loadTemplate('fitnessTemp.html');
            const htmlContent = replacePlaceholders(template, {});

            // 4. Send email
            try {
                await sendReminderEmail(
                    seller.email,
                    'Reminder: Upload Your Products on Oosri',
                    htmlContent,
                    `${seller.firstName} ${seller.lastName}`
                );
                reminderCount++;
                console.log(`✅ Reminder sent to ${seller.email}`);
            } catch (emailError) {
                console.error(`❌ Failed to send email to ${seller.email}:`, emailError.message);
            }
        }

        console.log(`🏁 Script finished. Sent ${reminderCount} reminders.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }
};

run();
