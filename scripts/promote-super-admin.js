/**
 * One-time script: promote admin@oosri.com to super_admin.
 * Run once from the backend root:
 *   node scripts/promote-super-admin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../src/Admin/Model/adminAuthModel');

const TARGET_EMAIL = 'admin@oosri.com';

async function promote() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const result = await Admin.findOneAndUpdate(
    { email: TARGET_EMAIL },
    { $set: { userRoles: 'super_admin', permissions: [] } },
    { new: true }
  );

  if (!result) {
    console.error(`No admin found with email: ${TARGET_EMAIL}`);
    process.exit(1);
  }

  console.log(`✅  ${result.email} is now a super_admin`);
  await mongoose.disconnect();
}

promote().catch((err) => {
  console.error(err);
  process.exit(1);
});
