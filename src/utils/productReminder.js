const cron = require('node-cron');
const Seller = require('../models/sellerModel');
const { Product } = require('../models/productModel');
const { sendProductUploadReminder } = require('../utils/emailService');

const sendProductUploadReminders = async () => {
  console.log('🔄 Starting product upload reminder job...');
  console.log(`⏰ Execution time: ${new Date().toLocaleString()}`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  try {
    const sellers = await Seller.find({
      isVerified: true,
      productUploadReminderSent: { $ne: true }
    }).select('_id email firstName lastName businessName');

    console.log(`📊 Found ${sellers.length} seller(s) to check`);

    if (sellers.length === 0) {
      console.log('✅ No sellers need reminders at this time');
      return;
    }

    for (const seller of sellers) {
      try {
        const productCount = await Product.countDocuments({
          seller: seller._id
        });

        if (productCount === 0) {
          const sellerName =
            seller.corporateBusinessAccount.companyName ||
            `${seller.firstName || ''} ${seller.lastName || ''}`.trim() ||
            'Seller';

          console.log(
            `📧 Sending reminder to: ${seller.email} (${sellerName}) - 0 products`
          );

          await sendProductUploadReminder(seller.email, sellerName);

          seller.productUploadReminderSent = true;
          seller.productUploadReminderSentAt = new Date();
          await seller.save();

          successCount++;
          console.log(`✅ Reminder sent successfully to ${seller.email}`);
        } else {
          console.log(
            `⏭️  Skipping ${seller.email} - already has ${productCount} product(s)`
          );
          seller.productUploadReminderSent = true;
          seller.productUploadReminderSentAt = new Date();
          await seller.save();

          skipCount++;
        }
      } catch (error) {
        errorCount++;
        console.error(
          `❌ Error processing seller ${seller.email}:`,
          error.message
        );
      }
    }

    console.log('\n📈 Product upload reminder job completed:');
    console.log(`   ✅ Emails sent: ${successCount}`);
    console.log(`   ⏭️  Sellers skipped (already have products): ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(
      `   📊 Total processed: ${successCount + skipCount + errorCount}\n`
    );
  } catch (error) {
    console.error('❌ Critical error in product upload reminder job:', error);
    throw error;
  }
};

const initProductReminderJob = () => {
  // Schedule to run every day at 10:00 AM
  // Cron format: '0 10 * * *'
  // minute (0-59) | hour (0-23) | day of month (1-31) | month (1-12) | day of week (0-6)

  cron.schedule(
    '0 10 * * *',
    async () => {
      console.log('\n🚀 Triggered: Product upload reminder cron job');
      try {
        await sendProductUploadReminders();
      } catch (error) {
        console.error('❌ Product upload reminder job failed:', error);
      }
    },
    {
      scheduled: true,
      timezone: 'Africa/Lagos'
    }
  );

  console.log(
    '✅ Product upload reminder job scheduled to run daily at 10:00 AM (Africa/Lagos timezone)'
  );
};

/**
 * Manual trigger function for testing or admin actions
 * Can be called from an admin endpoint if needed
 */
const manualTriggerProductReminder = async () => {
  console.log('🔧 Manual trigger: Product upload reminder');
  return await sendProductUploadReminders();
};

module.exports = {
  initProductReminderJob,
  sendProductUploadReminders,
  manualTriggerProductReminder
};
