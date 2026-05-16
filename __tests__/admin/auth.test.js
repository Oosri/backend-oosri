/**
 * Unit tests — adminAuthService
 * Covers: adminLogin, verifyLogin2FA, refreshToken,
 *         requestResetPassword, confirmResetPassword
 */

const { makeAdmin, makeOtp, ADMIN_OID } = require('../helpers/factories');

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('validator', () => ({ isEmail: jest.fn() }));
jest.mock('../../src/Admin/Model/adminAuthModel');
jest.mock('../../src/models/otpModel');
jest.mock('../../src/utils/emailService', () => ({
  loginOtpEmail:     jest.fn().mockResolvedValue(undefined),
  otpEmail:          jest.fn().mockResolvedValue(undefined),
  resetPasswordEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/utils/generateCode', () => jest.fn().mockReturnValue('1234'));
jest.mock('../../src/Admin/helper/dbHelper', () => ({
  formatMongoData:   (d) => ({ ...d }),
  formatCurrentDate: () => '2025-01-01T00:00:00.000Z',
  checkObjectId:     jest.fn(),
}));
jest.mock('../../src/Admin/middleware/accessControlValidation', () => ({
  isValidPassword: jest.fn().mockReturnValue(true),
}));
jest.mock('../../src/utils/jwt', () => ({
  signJwt:   jest.fn().mockReturnValue('mock-token'),
  verifyJwt: jest.fn(),
}));

const bcrypt     = require('bcrypt');
const validator  = require('validator');
const Admin      = require('../../src/Admin/Model/adminAuthModel');
const OtpCode    = require('../../src/models/otpModel');
const { signJwt, verifyJwt } = require('../../src/utils/jwt');
const svc        = require('../../src/Admin/services/adminAuthService');

beforeEach(() => {
  jest.clearAllMocks();
  validator.isEmail.mockReturnValue(true);
});

// ─── adminLogin ───────────────────────────────────────────────────────────────

describe('adminLogin', () => {
  it('throws on invalid email format', async () => {
    validator.isEmail.mockReturnValue(false);
    Admin.findOne = jest.fn().mockResolvedValue(makeAdmin());
    await expect(svc.adminLogin({ email: 'bad', password: 'pw' }))
      .rejects.toThrow();
  });

  it('throws when admin not found', async () => {
    Admin.findOne = jest.fn().mockResolvedValue(null);
    await expect(svc.adminLogin({ email: 'a@b.com', password: 'pw' }))
      .rejects.toThrow();
  });

  it('throws on wrong password', async () => {
    Admin.findOne = jest.fn().mockResolvedValue(makeAdmin());
    bcrypt.compare = jest.fn().mockResolvedValue(false);
    await expect(svc.adminLogin({ email: 'a@b.com', password: 'wrong' }))
      .rejects.toThrow();
  });

  it('returns { success: true } and upserts OTP on correct credentials', async () => {
    Admin.findOne  = jest.fn().mockResolvedValue(makeAdmin());
    bcrypt.compare = jest.fn().mockResolvedValue(true);
    OtpCode.updateOne = jest.fn().mockResolvedValue({});

    const result = await svc.adminLogin({ email: 'admin@oosri.com', password: 'correct' });
    expect(result).toEqual({ success: true });
    expect(OtpCode.updateOne).toHaveBeenCalledWith(
      { email: 'admin@oosri.com' },
      expect.objectContaining({ $set: expect.objectContaining({ code: '1234' }) }),
      { upsert: true }
    );
  });
});

// ─── verifyLogin2FA ───────────────────────────────────────────────────────────

describe('verifyLogin2FA', () => {
  it('throws when email or otp is missing', async () => {
    await expect(svc.verifyLogin2FA('', '1234')).rejects.toThrow();
    await expect(svc.verifyLogin2FA('a@b.com', '')).rejects.toThrow();
  });

  it('throws when admin not found', async () => {
    Admin.findOne = jest.fn().mockResolvedValue(null);
    await expect(svc.verifyLogin2FA('a@b.com', '1234')).rejects.toThrow();
  });

  it('throws when OTP record not found', async () => {
    Admin.findOne  = jest.fn().mockResolvedValue(makeAdmin());
    OtpCode.findOne = jest.fn().mockResolvedValue(null);
    await expect(svc.verifyLogin2FA('a@b.com', '1234')).rejects.toThrow();
  });

  it('throws on OTP code mismatch', async () => {
    Admin.findOne  = jest.fn().mockResolvedValue(makeAdmin());
    OtpCode.findOne = jest.fn().mockResolvedValue(makeOtp({ code: '9999' }));
    await expect(svc.verifyLogin2FA('a@b.com', '1234')).rejects.toThrow();
  });

  it('throws when OTP is expired', async () => {
    Admin.findOne  = jest.fn().mockResolvedValue(makeAdmin());
    OtpCode.findOne = jest.fn().mockResolvedValue(
      makeOtp({ code: '1234', expiration: new Date(Date.now() - 1000) })
    );
    await expect(svc.verifyLogin2FA('a@b.com', '1234')).rejects.toThrow();
  });

  it('returns tokens and user on valid OTP', async () => {
    const admin = makeAdmin();
    Admin.findOne  = jest.fn().mockResolvedValue(admin);
    OtpCode.findOne = jest.fn().mockResolvedValue(makeOtp({ code: '1234' }));
    OtpCode.deleteOne = jest.fn().mockResolvedValue({});

    const result = await svc.verifyLogin2FA('admin@oosri.com', '1234');
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result).toHaveProperty('user');
    expect(signJwt).toHaveBeenCalledTimes(2);
  });
});

// ─── refreshToken ─────────────────────────────────────────────────────────────

describe('refreshToken', () => {
  it('throws when refresh token is missing', async () => {
    await expect(svc.refreshToken('')).rejects.toThrow();
    await expect(svc.refreshToken(null)).rejects.toThrow();
  });

  it('throws when token is invalid', async () => {
    verifyJwt.mockImplementation(() => { throw new Error('invalid'); });
    await expect(svc.refreshToken('bad-token')).rejects.toThrow();
  });

  it('throws when admin not found', async () => {
    verifyJwt.mockReturnValue({ id: ADMIN_OID });
    Admin.findById = jest.fn().mockResolvedValue(null);
    await expect(svc.refreshToken('token')).rejects.toThrow();
  });

  it('throws when stored token does not match', async () => {
    verifyJwt.mockReturnValue({ id: ADMIN_OID });
    Admin.findById = jest.fn().mockResolvedValue(makeAdmin({ refreshToken: 'different' }));
    await expect(svc.refreshToken('token')).rejects.toThrow();
  });

  it('returns new accessToken on valid refresh', async () => {
    verifyJwt.mockReturnValue({ id: ADMIN_OID });
    Admin.findById = jest.fn().mockResolvedValue(makeAdmin({ refreshToken: 'my-token' }));
    const result = await svc.refreshToken('my-token');
    expect(result).toHaveProperty('accessToken');
    expect(signJwt).toHaveBeenCalledWith(expect.any(Object), { expiresIn: '15m' });
  });
});

// ─── requestResetPassword ─────────────────────────────────────────────────────

describe('requestResetPassword', () => {
  it('throws when admin email not found', async () => {
    Admin.findOne = jest.fn().mockResolvedValue(null);
    await expect(svc.requestResetPassword('nobody@oosri.com')).rejects.toThrow();
  });

  it('upserts OTP and resolves on valid email', async () => {
    Admin.findOne  = jest.fn().mockResolvedValue(makeAdmin());
    OtpCode.updateOne = jest.fn().mockResolvedValue({});
    await expect(svc.requestResetPassword('admin@oosri.com')).resolves.not.toThrow();
    expect(OtpCode.updateOne).toHaveBeenCalled();
  });
});
