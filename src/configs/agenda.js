require("dotenv").config();
const Agenda = require("agenda");
const mongoose = require("mongoose");
const { Product, Sculpture, Textiles, Pottery, Jewelry, Paintings }  = require("../../src/models/productModel");

const mongoConnectionString = process.env.MONGO_URI;
const agenda = new Agenda({ db: { address: mongoConnectionString, collection: "agendaJobs" } });
const runAgendaScheduler = process.env.RUN_AGENDA_SCHEDULER === 'true';

const syncProduct = require("../../src/Buyer/Service/buyerProductService");

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
    }

  } catch (error) {
    //console.error("❌ MongoDB Connection Error:", error);
  }
})();

module.exports = agenda;
