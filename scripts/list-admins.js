require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../src/Admin/Model/adminAuthModel');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const admins = await Admin.find({}, {
    email: 1, fullName: 1, userRoles: 1, permissions: 1, isConfirmed: 1, createdAt: 1
  }).lean();
  console.log(JSON.stringify(admins, null, 2));
  await mongoose.disconnect();
}
run().catch(e => { console.error(e.message); process.exit(1); });
