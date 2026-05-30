require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../src/Admin/Model/adminAuthModel');

const EMAIL = process.env.ADMIN_EMAIL || 'super.admin@oosri.com';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await Admin.findOneAndUpdate(
    { email: EMAIL },
    { $set: { userRoles: 'super_admin' } },
    { new: true }
  );
  if (!result) {
    console.error(`No admin found with email: ${EMAIL}`);
    process.exit(1);
  }
  console.log(`\n✅  ${result.email} → role: ${result.userRoles}\n`);
  await mongoose.disconnect();
}
run().catch(e => { console.error(e.message); process.exit(1); });
