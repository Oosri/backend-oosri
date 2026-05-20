/**
 * Shared mock-object factories.
 * Each factory returns a plain object that mimics a Mongoose document.
 * Pass an overrides object to customise any field.
 */

const VALID_OID   = '507f1f77bcf86cd799439011';
const SELLER_OID  = '507f191e810c19729de860ea';
const BUYER_OID   = '507f1f77bcf86cd799439022';
const ORDER_OID   = '507f1f77bcf86cd799439033';
const PRODUCT_OID = '507f1f77bcf86cd799439044';
const ADMIN_OID   = '507f1f77bcf86cd799439055';
const KYC_OID     = '507f1f77bcf86cd799439066';
const PAYOUT_OID  = '507f1f77bcf86cd799439077';

function doc(base, overrides = {}) {
  const merged = { ...base, ...overrides };
  return {
    ...merged,
    save:     jest.fn().mockResolvedValue(merged),
    toObject: jest.fn().mockReturnValue(merged),
  };
}

const makeAdmin = (o = {}) => doc({
  _id:          ADMIN_OID,
  fullName:     'Admin User',
  email:        'admin@oosri.com',
  password:     '$2b$12$hashedpassword',
  userRoles:    'admin',
  permissions:  ['products', 'orders'],
  refreshToken: 'refresh-token-hash',
  lastLogin:    null,
  updatedLastLogin: null,
}, o);

const makeBuyer = (o = {}) => doc({
  _id:         BUYER_OID,
  fullName:    'Test Buyer',
  email:       'buyer@test.com',
  password:    '$2b$12$hashedpassword',
  isConfirmed: true,
  isSuspended: false,
  deliveryAddresses: [],
}, o);

const makeSeller = (o = {}) => doc({
  _id:          SELLER_OID,
  firstName:    'Test',
  lastName:     'Seller',
  email:        'seller@test.com',
  password:     '$2b$12$hashedpassword',
  sellerStatus: 'Unverified',
  isVerified:   false,
  refreshToken: 'seller-refresh-hash',
}, o);

const makeOrder = (o = {}) => doc({
  _id:         ORDER_OID,
  userId:      { _id: BUYER_OID, fullName: 'Test Buyer', email: 'buyer@test.com' },
  orderStatus: 'pending',
  paymentStatus: 'paid',
  orderDate:   new Date('2025-01-01'),
  totalAmount: 100,
  products:    [{
    productId: { _id: PRODUCT_OID, productName: 'Test Product', images: ['img1.jpg'], price: 100 },
    sellerId:  { _id: SELLER_OID, firstName: 'Test', lastName: 'Seller' },
    productName: 'Test Product',
    quantity:  1,
    totalPrice: 5000,
  }],
  deliveryAddress: { address: '1 Test St', cityName: 'Lagos', countryCode: 'NG' },
  deliveryFee: 0,
}, o);

const makeProduct = (o = {}) => doc({
  _id:           PRODUCT_OID,
  productName:   'Test Product',
  productStatus: 'pending',
  isApproved:    false,
  isVisible:     true,
  regularPrice:  5000,
  inStock:       10,
  images:        ['img1.jpg', 'img2.jpg'],
  seller:        SELLER_OID,
  category:      { _id: VALID_OID, name: 'Art' },
}, o);

const makeKyc = (o = {}) => doc({
  _id:        KYC_OID,
  sellerId:   { _id: SELLER_OID, firstName: 'Test', lastName: 'Seller', email: 'seller@test.com' },
  status:     'pending',
  submittedAt: new Date('2025-01-01'),
  reviewedBy:  null,
  reviewedAt:  null,
  rejectionReason: null,
  timeline:   [],
  documents:  { governmentId: null, proofOfAddress: null, businessCertificate: null },
}, o);

const makePayout = (o = {}) => doc({
  _id:              PAYOUT_OID,
  payout_reference: 'PAY-001',
  status:           'pending',
  total_usd_cents:  10000,
  total_ngn_kobo:   1500000,
}, o);

const makeNotif = (o = {}) => doc({
  _id:     VALID_OID,
  ownerId: BUYER_OID,
  type:    'order_placed',
  title:   'Order Placed',
  message: 'Your order has been placed.',
  isRead:  false,
  metadata: {},
}, o);

const makeOtp = (o = {}) => ({
  email:      'test@test.com',
  code:       '1234',
  expiration: new Date(Date.now() + 10 * 60 * 1000),
  ...o,
});

module.exports = {
  VALID_OID, SELLER_OID, BUYER_OID, ORDER_OID,
  PRODUCT_OID, ADMIN_OID, KYC_OID, PAYOUT_OID,
  makeAdmin, makeBuyer, makeSeller, makeOrder,
  makeProduct, makeKyc, makePayout, makeNotif, makeOtp,
};
