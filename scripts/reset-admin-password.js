/**
 * One-time script: create or reset an admin account password.
 * Safe to run against production — creates the account if missing,
 * or resets the password if it already exists.
 *
 * Usage:
 *   MONGO_URI=<uri> ADMIN_EMAIL=super.admin@oosri.com ADMIN_PASSWORD=NewPass123 node scripts/reset-admin-password.js
 *
 * Defaults (if env vars not set):
 *   ADMIN_EMAIL    → super.admin@oosri.com
 *   ADMIN_PASSWORD → Admin@1234
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('../src/Admin/Model/adminAuthModel');

const EMAIL    = process.env.ADMIN_EMAIL    || 'super.admin@oosri.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1234';
const FULLNAME = process.env.ADMIN_NAME     || 'Super Admin';

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌  MONGO_URI env var is required.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const hashed = await bcrypt.hash(PASSWORD, 12);
  const existing = await Admin.findOne({ email: EMAIL });

  if (existing) {
    existing.password = hashed;
    existing.refreshToken = null;
    await existing.save();
    console.log(`\n✅  Password reset for existing account: ${EMAIL}\n`);
  } else {
    await Admin.create({
      email:       EMAIL,
      password:    hashed,
      fullName:    FULLNAME,
      userRoles:   'super_admin',
      isConfirmed: true,
    });
    console.log(`\n✅  New super admin account created: ${EMAIL}\n`);
  }

  console.log('   Email   :', EMAIL);
  console.log('   Password:', PASSWORD);
  console.log('   ⚠️  Change this password after first login.\n');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
