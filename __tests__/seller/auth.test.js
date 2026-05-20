/**
 * Unit tests — seller auth controller (sign-in, sign-out, refresh-token)
 * Tests the controller functions directly with mock req/res objects.
 * Registration is file-upload heavy so it is covered at the route level.
 */

const { makeSeller, SELLER_OID } = require('../helpers/factories');

jest.mock('../../src/models/sellerModel');
jest.mock('../../src/models/otpModel');
jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('jsonwebtoken', () => ({
  sign:   jest.fn().mockReturnValue('mock-access-token'),
  verify: jest.fn(),
}));
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn().mockReturnValue({ toString: () => 'random-refresh-token' }),
  createHash:  jest.fn().mockReturnValue({ update: jest.fn().mockReturnValue({ digest: jest.fn().mockReturnValue('hashed-token') }) }),
}));
jest.mock('../../src/utils/emailService', () => ({
  loginOtpEmail:     jest.fn().mockResolvedValue(undefined),
  sellerSignInEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/utils/generateCode', () => jest.fn().mockReturnValue('1234'));
jest.mock('../../src/Admin/services/adminNotificationService', () => ({
  create: jest.fn().mockResolvedValue({}),
}));
// Silence queue imports
jest.mock('../../src/queues/image.queue', () => ({ addImageJob: jest.fn() }), { virtual: true });
jest.mock('../../src/queues/email.queue', () => ({ addEmailJob: jest.fn() }), { virtual: true });
jest.mock('../../src/utils/cloudinary', () => ({
  uploadSellerProfilePicture: jest.fn(),
  uploadSellerDocument: jest.fn(),
}));
jest.mock('../../src/utils/cloudinarySignature', () => ({
  generatePresignedUrl: jest.fn(),
  validateCloudinaryUrl: jest.fn(),
  extractPublicId: jest.fn(),
}));
jest.mock('cloudinary', () => ({ v2: { uploader: { destroy: jest.fn() } } }));
jest.mock('../../src/utils/avatarMap', () => ({ avatarMap: {} }));
jest.mock('basic-ftp', () => ({ Client: jest.fn() }));

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const Seller  = require('../../src/models/sellerModel');
const OtpCode = require('../../src/models/otpModel');

const {
  sellerAccountSignin,
  sellerSignOut,
  sellerRefreshToken,
} = require('../../src/controllers/sellerAuth.controller');

function mockRes() {
  const res = {};
  res.status  = jest.fn().mockReturnValue(res);
  res.json    = jest.fn().mockReturnValue(res);
  res.cookie  = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

// ─── sellerAccountSignin ──────────────────────────────────────────────────────

describe('sellerAccountSignin', () => {
  it('returns 401 when seller not found', async () => {
    Seller.findOne = jest.fn().mockResolvedValue(null);
    const res = mockRes();
    await sellerAccountSignin({ body: { email: 'x@test.com', password: 'pw' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 on wrong password', async () => {
    Seller.findOne = jest.fn().mockResolvedValue(makeSeller());
    bcrypt.compare = jest.fn().mockResolvedValue(false);
    const res = mockRes();
    await sellerAccountSignin({ body: { email: 'seller@test.com', password: 'wrong' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns consistent error message regardless of not-found vs wrong-password', async () => {
    // Not found case
    Seller.findOne = jest.fn().mockResolvedValue(null);
    const res1 = mockRes();
    await sellerAccountSignin({ body: { email: 'x@test.com', password: 'pw' } }, res1);
    const notFoundMsg = res1.json.mock.calls[0][0]?.message;

    // Wrong password case — must be verified so the password check is reached
    Seller.findOne = jest.fn().mockResolvedValue(makeSeller({ isVerified: true }));
    bcrypt.compare = jest.fn().mockResolvedValue(false);
    const res2 = mockRes();
    await sellerAccountSignin({ body: { email: 'seller@test.com', password: 'wrong' } }, res2);
    const wrongPwMsg = res2.json.mock.calls[0][0]?.message;

    // Both messages must be identical to prevent user enumeration
    expect(notFoundMsg).toBe(wrongPwMsg);
  });

  it('returns 200 with tokens on valid credentials', async () => {
    const seller = makeSeller({ isVerified: true });
    Seller.findOne = jest.fn().mockResolvedValue(seller);
    bcrypt.compare = jest.fn().mockResolvedValue(true);

    const res = mockRes();
    await sellerAccountSignin({ body: { email: 'seller@test.com', password: 'correct' } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('token');
    expect(body).toHaveProperty('refreshToken');
  });
});

// ─── sellerRefreshToken ───────────────────────────────────────────────────────

describe('sellerRefreshToken', () => {
  it('returns 400 when refresh token is missing', async () => {
    const res = mockRes();
    await sellerRefreshToken({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 401 when no seller matches the token hash', async () => {
    Seller.findOne = jest.fn().mockResolvedValue(null);
    const res = mockRes();
    await sellerRefreshToken({ body: { refreshToken: 'old-token' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns new accessToken on valid refresh token', async () => {
    const seller = makeSeller();
    Seller.findOne = jest.fn().mockResolvedValue(seller);

    const res = mockRes();
    await sellerRefreshToken({ body: { refreshToken: 'valid-refresh' } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('token');
  });
});

// ─── sellerSignOut ────────────────────────────────────────────────────────────

describe('sellerSignOut', () => {
  it('clears refresh token and returns 200', async () => {
    Seller.updateOne = jest.fn().mockResolvedValue({});
    const res = mockRes();
    await sellerSignOut({ body: { refreshToken: 'token' } }, res);

    expect(Seller.updateOne).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
