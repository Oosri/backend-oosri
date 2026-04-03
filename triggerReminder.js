const dotenv = require('dotenv');
const dbConnect = require('./src/configs/database');
const { sendProductUploadReminders } = require('./src/utils/productReminder');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

async function trigger() {
    process.env.ENVIRONMENT = process.env.ENVIRONMENT || 'production';
    console.log(`🚀 Manual trigger started in [${process.env.ENVIRONMENT}] mode`);

    try {
        // Connect to database (uses internal logic in dbConnect for URI selection)
        await dbConnect();

        // Run the reminder job
        await sendProductUploadReminders();

        console.log('✅ Manual trigger finished. Closing connection...');
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Manual trigger failed:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
}

trigger();
