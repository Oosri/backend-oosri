const cron = require('node-cron');
const { Product } = require('../models/productModel');
const Seller = require('../models/sellerModel');
const sendEmail = require('./emailService');

const runCriticalStockAlerts = async () => {
  try {
    // Find products at qty ≤ 1 where the critical alert hasn't been sent yet
    const products = await Product.find({
      inStock: { $lte: 1 },
      isVisible: true,
      criticalStockAlertSent: false,
    }).select('_id productName inStock seller criticalStockAlertSent').lean();

    if (!products.length) return;

    console.log(`[CriticalStock] Found ${products.length} product(s) at qty ≤ 1`);

    for (const product of products) {
      try {
        const seller = await Seller.findById(product.seller).select('email firstName lastName').lean();
        if (!seller?.email) continue;

        const sellerName = `${seller.firstName || ''} ${seller.lastName || ''}`.trim() || 'Seller';

        await sendEmail.lowStockAlert(
          seller.email,
          sellerName,
          product.productName,
          product.inStock,
          1
        );

        await Product.updateOne({ _id: product._id }, { $set: { criticalStockAlertSent: true } });

        console.log(`[CriticalStock] Alert sent → ${seller.email} for "${product.productName}" (qty: ${product.inStock})`);
      } catch (err) {
        console.error(`[CriticalStock] Failed for product ${product._id}:`, err.message);
      }
    }

    // Reset the flag for products that have been restocked above 1
    await Product.updateMany(
      { inStock: { $gt: 1 }, criticalStockAlertSent: true },
      { $set: { criticalStockAlertSent: false } }
    );
  } catch (err) {
    console.error('[CriticalStock] Cron job error:', err.message);
  }
};

const initCriticalStockAlertJob = () => {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[CriticalStock] Running critical stock alert check...');
    await runCriticalStockAlerts();
  }, {
    scheduled: true,
    timezone: 'Africa/Lagos',
  });

  console.log('[CriticalStock] Critical stock alert job scheduled (hourly).');
};

module.exports = { initCriticalStockAlertJob, runCriticalStockAlerts };
