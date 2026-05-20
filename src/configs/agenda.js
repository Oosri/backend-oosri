require("dotenv").config();
const Agenda = require("agenda");
const mongoose = require("mongoose");
const { Product, Sculpture, Textiles, Pottery, Jewelry, Paintings }  = require("../../src/models/productModel");
const UserCart = require("../../src/Buyer/models/buyerCartModel");
const Buyer = require("../../src/Buyer/models/buyerAuthModel");
const sendEmail = require("../../src/utils/emailService");

const mongoConnectionString = process.env.MONGO_URI;
const agenda = new Agenda({ db: { address: mongoConnectionString, collection: "agendaJobs" } });
const runAgendaScheduler = process.env.RUN_AGENDA_SCHEDULER === 'true';

const syncProduct = require("../../src/Buyer/Service/buyerProductService");

agenda.define("abandoned cart recovery", async (job) => {
  try {
    const now = new Date();
    const cutoff24h = new Date(now - 24 * 60 * 60 * 1000);
    const cutoff48h = new Date(now - 48 * 60 * 60 * 1000);

    const carts = await UserCart.find({
      userId: { $ne: null },
      'items.0': { $exists: true },
      updatedAt: { $lt: cutoff24h },
      $or: [
        { lastAbandonedReminderAt: null },
        { lastAbandonedReminderAt: { $lt: cutoff48h } }
      ]
    }).populate('userId', 'email fullName')
      .populate('items.productId', 'productName images regularPrice salesPrice');

    for (const cart of carts) {
      const buyer = cart.userId;
      if (!buyer || !buyer.email) continue;

      const items = cart.items
        .filter(i => i.productId)
        .map(i => ({
          productName: i.productId.productName,
          image: (i.productId.images || [])[0] || '',
          price: i.productId.salesPrice || i.productId.regularPrice,
          quantity: i.quantity
        }));

      if (!items.length) continue;

      const cartUrl = `${process.env.BUYER_URL || ''}/cart`;

      try {
        await sendEmail.abandonedCartEmail(buyer.email, buyer.fullName, items, cartUrl);
        cart.lastAbandonedReminderAt = now;
        await cart.save();
      } catch (emailErr) {
        console.error(`Abandoned cart email failed for user ${buyer._id}:`, emailErr);
      }
    }
  } catch (error) {
    console.error("Error in abandoned cart recovery job:", error);
  }
});

agenda.define("approve product", async (job) => {
  try {
    const { _id } = job.attrs.data;

    const product = await Product.findOne({ 
      _id: new mongoose.Types.ObjectId(_id.toString()), 
      productStatus: "pending" 
    });

    if (product) {
      product.productStatus = "approved";
      product.isApproved = true;
      const savedProduct = await product.save();

      // Sync to Algolia after approval
      try {
        await syncProduct.syncProductsToAlgolia(savedProduct);
      } catch (syncError) {
        console.error(`Algolia sync failed for approved product ${_id}:`, syncError);
      }

      await job.remove();
    }
  } catch (error) {
    console.error("Error in approve product job:", error);
  }
});

(async function () {
  try {
    await mongoose.connect(mongoConnectionString);
    if (runAgendaScheduler) {
      await agenda.start();
      await agenda.every("10 minutes", "approve product");
      await agenda.every("1 hour", "abandoned cart recovery");
    }

  } catch (error) {
    //console.error("❌ MongoDB Connection Error:", error);
  }
})();

module.exports = agenda;
