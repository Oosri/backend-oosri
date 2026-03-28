const mongoose = require('mongoose');
const FxRate = require('./src/models/fxRateModel');

async function testUpsert() {
    await mongoose.connect('mongodb://127.0.0.1:27017/oosri_local_test');

    try {
        const adminId = new mongoose.Types.ObjectId();
        const usdToNgnRate = 1350;
        const note = "Test note";

        const rateDoc = await FxRate.findOneAndUpdate(
            { isActive: true },
            {
                usdToNgnRate,
                setByAdminId: adminId,
                note,
                isActive: true,
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
                runValidators: true,
            }
        );
        console.log("Upsert Success:", rateDoc);
    } catch (err) {
        console.error("Upsert Failed:", err);
    } finally {
        process.exit(0);
    }
}

testUpsert();
