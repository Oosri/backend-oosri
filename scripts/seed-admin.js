/**
 * Creates a test admin account directly in the database.
 * Run: node scripts/seed-admin.js
 *
 * You can override credentials via env vars:
 *   SEED_EMAIL=me@example.com SEED_PASSWORD=MyPass123 node scripts/seed-admin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dbConnect = require('../src/configs/database');
const Admin = require('../src/Admin/Model/adminAuthModel');

const EMAIL    = process.env.SEED_EMAIL    || 'admin@oosri.com';
const PASSWORD = process.env.SEED_PASSWORD || 'Admin@1234';
const FULLNAME = process.env.SEED_NAME     || 'Super Admin';

async function seed() {
  await dbConnect();

  const existing = await Admin.findOne({ email: EMAIL });
  if (existing) {
    console.log(`\n⚠️  Admin already exists: ${EMAIL}`);
    console.log('   Delete it first if you want to reset the password.\n');
    await mongoose.disconnect();
    return;
  }

  const hashed = await bcrypt.hash(PASSWORD, 12);
  await Admin.create({
    email:       EMAIL,
    password:    hashed,
    fullName:    FULLNAME,
    userRoles:   'admin',
    isConfirmed: true,
  });

  console.log('\n✅  Admin account created successfully!\n');
  console.log('   Email   :', EMAIL);
  console.log('   Password:', PASSWORD);
  console.log('\n   The login flow will send a 4-digit OTP to that email address.');
  console.log('   Make sure your SMTP env vars are set so the OTP email arrives.\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
