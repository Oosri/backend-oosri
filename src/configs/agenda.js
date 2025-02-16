require("dotenv").config();
const Agenda = require("agenda");
const mongoose = require("mongoose");
const { Product, Sculpture, Textiles, Pottery, Jewelry, Paintings }  = require("../../src/models/productModel");

const mongoConnectionString = process.env.MONGO_URI;
const agenda = new Agenda({ db: { address: mongoConnectionString, collection: "agendaJobs" } });

agenda.define("approve product", async (job) => {
  try {
    const { _id } = job.attrs.data;
    console.log(`🔍 Checking product ID: ${_id}`);

    const product = await Product.findOne({ 
      _id: new mongoose.Types.ObjectId(_id.toString()), 
      productStatus: "pending" 
    });

    if (product) {
      product.productStatus = "approved";
      await product.save();
   //   console.log(`✅ Product ${_id} approved`);
      await job.remove();
     // console.log(`🗑️ Job ${job.attrs._id} deleted`);
    } else {
      //console.log(`⚠️ No pending product found with ID: ${_id}`);
    }
  } catch (error) {
    //console.error("❌ Error updating product status:", error);
  }
});

(async function () {
  try {
    await mongoose.connect(mongoConnectionString);
    //console.log("✅ MongoDB connected");

    await agenda.start();
    //console.log("✅ Agenda scheduler started");

    await agenda.every("10 minutes", "approve product");

  } catch (error) {
    //console.error("❌ MongoDB Connection Error:", error);
  }
})();

module.exports = agenda;
