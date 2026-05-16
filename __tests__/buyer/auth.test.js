/**
 * Unit tests — buyerAuthService
 * Covers: registerBuyer, resendOtp, confirmOtp, buyerLogin, refreshToken, logout
 */

const { makeBuyer, makeOtp, BUYER_OID } = require('../helpers/factories');

jest.mock('../../src/Buyer/models/buyerAuthModel');
jest.mock('../../src/models/sellerModel');
jest.mock('../../src/models/otpModel');
jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('validator', () => ({ isEmail: jest.fn().mockReturnValue(true) }));
jest.mock('../../src/utils/emailService', () => ({
  sendOtpEmail:     jest.fn().mockResolvedValue(undefined),
  confirmOtpEmail:  jest.fn().mockResolvedValue(undefined),
  passwordResetEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/utils/generateCode', () => jest.fn().mockReturnValue('5678'));
jest.mock('../../src/Buyer/helper/dbHelper', () => ({
  formatMongoData:    (d) => ({ ...d }),
  checkObjectId:      jest.fn(),
  formatCurrentDate:  () => new Date().toISOString(),
}));
jest.mock('../../src/Buyer/constants', () => ({
  buyerAuthMessage: {
    INVALID_EMAIL:     'Invalid email',
    DUPLICATE_EMAIL:   'Email already in use',
    EMAIL_NOT_ALLOWED: 'Email registered as seller',
    WEAK_PASSWORD:     'Password too weak',
    USER_NOT_FOUND:    'User not found',
    INVALID_OTP:       'Invalid OTP',
    OTP_EXPIRED:       'OTP expired',
    INVALID_PASSWORD:  'Invalid password',
    INVALID_TOKEN:     'Invalid token',
    ACCOUNT_NOT_CONFIRMED: 'Account not confirmed',
    REFRESH_TOKEN_MISSING: 'Refresh token missing',
  },
  requestValidationMessage: { TOKEN_MISSING: 'Token missing' },
}));
jest.mock('../../src/Buyer/middlewares/accessControlValidation', () => ({
  isValidPassword: jest.fn().mockReturnValue(true),
}));
jest.mock('../../src/utils/jwt', () => ({
  signJwt:   jest.fn().mockReturnValue('mock-jwt'),
  verifyJwt: jest.fn(),
}));

const bcrypt    = require('bcrypt');
const validator = require('validator');
const Buyer     = require('../../src/Buyer/models/buyerAuthModel');
const Seller    = require('../../src/models/sellerModel');
const OtpCode   = require('../../src/models/otpModel');
const { verifyJwt } = require('../../src/utils/jwt');
const svc       = require('../../src/Buyer/Service/buyerAuthService');

beforeEach(() => {
  jest.clearAllMocks();
  validator.isEmail.mockReturnValue(true);
});

// ─── registerBuyer ────────────────────────────────────────────────────────────

describe('registerBuyer', () => {
  const validInput = {
    email: 'buyer@test.com', password: 'Str0ng!Pass', fullName: 'Test Buyer',
  };

  it('throws on invalid email format', async () => {
    validator.isEmail.mockReturnValue(false);
    await expect(svc.registerBuyer(validInput)).rejects.toThrow();
  });

  it('throws when email already exists as buyer', async () => {
    Buyer.findOne  = jest.fn().mockResolvedValue(makeBuyer());
    Seller.findOne = jest.fn().mockResolvedValue(null);
    await expect(svc.registerBuyer(validInput)).rejects.toThrow();
  });

  it('throws when email is already registered as a seller', async () => {
    Buyer.findOne  = jest.fn().mockResolvedValue(null);
    Seller.findOne = jest.fn().mockResolvedValue({ _id: 'seller-id' });
    await expect(svc.registerBuyer(validInput)).rejects.toThrow();
  });

  it('creates buyer and sends OTP on valid input', async () => {
    const buyer = makeBuyer();
    Buyer.findOne  = jest.fn().mockResolvedValue(null);
    Seller.findOne = jest.fn().mockResolvedValue(null);
    bcrypt.hash    = jest.fn().mockResolvedValue('hashed-pw');
    OtpCode.updateOne = jest.fn().mockResolvedValue({});

    const mockSave = jest.fn().mockResolvedValue({ ...buyer, toObject: () => buyer });
    Buyer.mockImplementation(() => ({ ...buyer, save: mockSave, toObject: () => buyer }));

    const result = await svc.registerBuyer(validInput);
    expect(bcrypt.hash).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
    expect(OtpCode.updateOne).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

// ─── resendOtp ────────────────────────────────────────────────────────────────

describe('resendOtp', () => {
  it('throws when buyer not found', async () => {
    Buyer.findOne = jest.fn().mockResolvedValue(null);
    await expect(svc.resendOtp('nobody@test.com')).rejects.toThrow();
  });

  it('upserts OTP and resolves for existing buyer', async () => {
    Buyer.findOne  = jest.fn().mockResolvedValue(makeBuyer());
    OtpCode.updateOne = jest.fn().mockResolvedValue({});
    await expect(svc.resendOtp('buyer@test.com')).resolves.not.toThrow();
    expect(OtpCode.updateOne).toHaveBeenCalled();
  });
});

// ─── confirmOtp ───────────────────────────────────────────────────────────────

describe('confirmOtp', () => {
  it('throws when buyer not found', async () => {
    Buyer.findOne  = jest.fn().mockResolvedValue(null);
    OtpCode.findOne = jest.fn().mockResolvedValue(makeOtp({ code: '5678' }));
    await expect(svc.confirmOtp('nobody@test.com', '5678')).rejects.toThrow();
  });

  it('throws on OTP code mismatch', async () => {
    Buyer.findOne  = jest.fn().mockResolvedValue(makeBuyer({ isConfirmed: false }));
    OtpCode.findOne = jest.fn().mockResolvedValue(makeOtp({ code: '9999' }));
    await expect(svc.confirmOtp('buyer@test.com', '1111')).rejects.toThrow();
  });

  it('throws when OTP is expired', async () => {
    Buyer.findOne  = jest.fn().mockResolvedValue(makeBuyer({ isConfirmed: false }));
    OtpCode.findOne = jest.fn().mockResolvedValue(
      makeOtp({ code: '5678', expiration: new Date(Date.now() - 1000) })
    );
    await expect(svc.confirmOtp('buyer@test.com', '5678')).rejects.toThrow();
  });

  it('confirms buyer account on valid OTP', async () => {
    const buyer = makeBuyer({ isConfirmed: false });
    Buyer.findOne  = jest.fn().mockResolvedValue(buyer);
    OtpCode.findOne = jest.fn().mockResolvedValue(makeOtp({ code: '5678' }));
    OtpCode.deleteOne = jest.fn().mockResolvedValue({});

    await svc.confirmOtp('buyer@test.com', '5678');
    expect(buyer.isConfirmed).toBe(true);
    expect(buyer.save).toHaveBeenCalled();
  });
});

// ─── buyerLogin ───────────────────────────────────────────────────────────────

describe('buyerLogin', () => {
  it('throws when buyer not found', async () => {
    Buyer.findOne  = jest.fn().mockResolvedValue(null);
    await expect(svc.buyerLogin({ email: 'a@b.com', password: 'pw' })).rejects.toThrow();
  });

  it('throws on wrong password', async () => {
    Buyer.findOne  = jest.fn().mockResolvedValue(makeBuyer());
    bcrypt.compare = jest.fn().mockResolvedValue(false);
    await expect(svc.buyerLogin({ email: 'buyer@test.com', password: 'wrong' })).rejects.toThrow();
  });

  it('returns tokens and user on valid credentials', async () => {
    const buyer = makeBuyer({ isConfirmed: true });
    Buyer.findOne  = jest.fn().mockResolvedValue(buyer);
    bcrypt.compare = jest.fn().mockResolvedValue(true);

    const result = await svc.buyerLogin({ email: 'buyer@test.com', password: 'correct' });
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe('logout', () => {
  it('clears refreshTokenHash from buyer document', async () => {
    const buyer = makeBuyer({ refreshTokenHash: 'some-hash' });
    Buyer.findByIdAndUpdate = jest.fn().mockResolvedValue(buyer);

    await svc.logout(BUYER_OID);
    expect(Buyer.findByIdAndUpdate).toHaveBeenCalledWith(
      BUYER_OID,
      expect.objectContaining({ $unset: expect.objectContaining({ refreshTokenHash: expect.anything() }) })
    );
  });
});
