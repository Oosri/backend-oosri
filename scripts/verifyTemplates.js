/**
 * Verifies all email templates:
 *  - Substitutes dummy data into every placeholder
 *  - Fails if any {{placeholder}} remains unresolved
 *  - Writes rendered HTML to scripts/templates-preview/ for browser inspection
 *
 * Usage: node scripts/verifyTemplates.js
 */

const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '../src/utils/emailTemplates');
const PREVIEW_DIR = path.join(__dirname, 'templates-preview');

if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR);

const replacePlaceholders = (template, data) =>
  template.replace(/{{\s*(\w+)\s*}}/g, (match, key) =>
    data[key] !== undefined ? data[key] : match
  );

// Dummy data covering every placeholder across all templates
const dummyData = {
  // Common
  year: new Date().getFullYear(),
  fullName: 'Adaeze Johnson',
  buyerName: 'Adaeze Johnson',
  sellerName: 'Emeka Crafts',

  // OTP / 2FA / Password Reset
  otp1: '4', otp2: '8', otp3: '2', otp4: '7',
  otp5: '1', otp6: '9',

  // Onboarding
  username: 'adaeze@example.com',
  password: 'SecurePass123',

  // Orders
  orderId: 'ORD-2026-00142',
  totalAmount: '45,000',
  netAmountNGN: '38,250',
  platformFeeNGN: '6,750',
  currencySymbol: '₦',
  ordersCount: '3',
  ordersList: '<p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:14px;color:#555;">Order #ORD-001 · Adire Fabric · ₦15,000</p><p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:14px;color:#555;">Order #ORD-002 · Leather Bag · ₦18,000</p><p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#555;">Order #ORD-003 · Ankara Dress · ₦12,000</p>',
  itemsList: '<p style="margin:0 0 4px;">• Adire Fabric x2</p><p style="margin:0 0 4px;">• Leather Bag x1</p>',
  newStatus: 'processing',
  statusMessage: 'Your order is currently being prepared and will be dispatched soon.',

  // Images (order placed)
  image1: 'https://res.cloudinary.com/du18mzeaf/image/upload/v1767565622/a67764c983fd58fc6fff31c5d83dfd1a_qp4h42.png',
  image2: 'https://res.cloudinary.com/du18mzeaf/image/upload/v1767565622/a67764c983fd58fc6fff31c5d83dfd1a_qp4h42.png',
  image3: 'https://res.cloudinary.com/du18mzeaf/image/upload/v1767565622/a67764c983fd58fc6fff31c5d83dfd1a_qp4h42.png',

  // Payment
  failureReason: 'Insufficient funds on the provided card.',
  errorMessage: 'Adire Fabric (qty 2) sold out during checkout processing.',

  // Refund / Return
  refundAmount: '15,000',
  returnStatus: 'admin_approved',
  statusMessage2: 'Your return request has been approved. A refund will be processed within 5–10 business days.',

  // Support internal alerts
  disputeId: 'dp_1NxZzd2eZvKYlo2CJdDpN0uQ',
  reason: 'Product not as described',
  paymentIds: 'pi_3NxZzd2eZvKYlo2C1vF5T2Xp, pi_3NxZzd2eZvKYlo2C1vF5T3Xq',
  paymentIntentId: 'pi_3NxZzd2eZvKYlo2C1vF5T2Xp',
  buyerId: 'buyer_64f8a2b3c9d1e4f5a6b7c8d9',
  originalError: 'StockDepletionError: Adire Fabric (SKU: ADF-001) quantity 2 unavailable; only 0 remain.',
  refundError: 'StripeError: charge_already_refunded — The charge has already been refunded.',
};

const templates = [
  { file: 'otp-email-template.html',         label: 'OTP Verification' },
  { file: 'login-2fa-email-template.html',   label: 'Login 2FA' },
  { file: 'resetPasswordEmail-template.html', label: 'Password Reset' },
  { file: 'onBoarding-templates.html',        label: 'Onboarding' },
  { file: 'orderPlaced-template.html',        label: 'Order Placed' },
  { file: 'orderStatusUpdate.html',           label: 'Order Status Update' },
  { file: 'buyerPurchaseConfirmation.html',   label: 'Buyer Purchase Confirmation' },
  { file: 'buyerStockFailure.html',           label: 'Buyer Stock Failure' },
  { file: 'paymentFailure.html',              label: 'Payment Failure' },
  { file: 'returnStatusUpdate.html',          label: 'Return Status Update' },
  { file: 'sellerOrderNotification.html',     label: 'Seller Order Notification' },
  { file: 'sellerRefundNotification.html',    label: 'Seller Refund Notification' },
  { file: 'sellerVerified.html',              label: 'Seller Verified' },
  { file: 'productUploadReminder.html',       label: 'Product Upload Reminder' },
  { file: 'supportDisputeAlert.html',         label: 'Support Dispute Alert' },
  { file: 'supportUrgentRefund.html',         label: 'Support Urgent Refund' },
];

let passed = 0;
let failed = 0;

for (const { file, label } of templates) {
  const filePath = path.join(TEMPLATE_DIR, file);

  if (!fs.existsSync(filePath)) {
    console.error(`❌  [${label}] File not found: ${file}`);
    failed++;
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const rendered = replacePlaceholders(raw, dummyData);

  // Check for unresolved placeholders
  const unresolved = [...rendered.matchAll(/{{\s*(\w+)\s*}}/g)].map(m => m[1]);

  if (unresolved.length > 0) {
    console.error(`❌  [${label}] Unresolved placeholders: ${[...new Set(unresolved)].join(', ')}`);
    failed++;
  } else {
    console.log(`✅  [${label}]`);
    passed++;
  }

  // Write rendered preview
  const outFile = path.join(PREVIEW_DIR, file);
  fs.writeFileSync(outFile, rendered, 'utf8');
}

console.log(`\n${passed} passed, ${failed} failed`);
console.log(`\nRendered previews written to: scripts/templates-preview/`);
console.log('Open any .html file in your browser to visually inspect it.');

if (failed > 0) process.exit(1);
