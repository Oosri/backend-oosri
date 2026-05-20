/**
 * Unit tests — adminKycService
 * Covers: getAllKyc, getKycById, approveKyc, rejectKyc
 */

const {
  makeKyc, makeSeller,
  SELLER_OID, KYC_OID, VALID_OID,
} = require('../helpers/factories');

jest.mock('../../src/Admin/Model/sellerKycModel');
jest.mock('../../src/models/sellerModel');
jest.mock('../../src/models/sellerNotificationModel');
jest.mock('../../src/utils/emailService', () => ({
  kycApproved: jest.fn().mockResolvedValue(undefined),
  kycRejected: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/utils/notificationService', () =>
  jest.fn().mockReturnValue({ create: jest.fn().mockResolvedValue({}) })
);
jest.mock('../../src/utils/escapeRegex', () => (s) => s);

const SellerKyc = require('../../src/Admin/Model/sellerKycModel');
const Seller    = require('../../src/models/sellerModel');
const svc       = require('../../src/Admin/services/adminKycService');

beforeEach(() => jest.clearAllMocks());

// ─── getAllKyc ────────────────────────────────────────────────────────────────

describe('getAllKyc', () => {
  function setupList(records = [makeKyc()], total = 1) {
    const chain = {
      populate: jest.fn().mockReturnThis(),
      sort:     jest.fn().mockReturnThis(),
      skip:     jest.fn().mockReturnThis(),
      limit:    jest.fn().mockResolvedValue(records.map(r => ({ ...r, toObject: () => r }))),
    };
    SellerKyc.find            = jest.fn().mockReturnValue(chain);
    SellerKyc.countDocuments  = jest.fn().mockResolvedValue(total);
  }

  it('returns paginated records with no filters', async () => {
    setupList();
    const result = await svc.getAllKyc({ page: 1, limit: 10 });
    expect(result.records).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('applies status filter to query', async () => {
    setupList([], 0);
    await svc.getAllKyc({ status: 'approved' });
    expect(SellerKyc.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
  });

  it('pre-looks up sellers when search is provided', async () => {
    Seller.find = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: SELLER_OID }]),
    });
    setupList([], 0);
    await svc.getAllKyc({ search: 'Test' });
    expect(Seller.find).toHaveBeenCalled();
    expect(SellerKyc.find).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: { $in: [SELLER_OID] } })
    );
  });

  it('calculates totalPages = 1 when total is 0', async () => {
    setupList([], 0);
    const result = await svc.getAllKyc({});
    expect(result.totalPages).toBe(1);
  });

  it('calculates correct totalPages for multi-page results', async () => {
    setupList(new Array(5).fill(makeKyc()), 25);
    const result = await svc.getAllKyc({ page: 1, limit: 5 });
    expect(result.totalPages).toBe(5);
  });
});

// ─── getKycById ───────────────────────────────────────────────────────────────

describe('getKycById', () => {
  it('throws on invalid ObjectId', async () => {
    await expect(svc.getKycById('not-valid')).rejects.toThrow();
  });

  it('throws when KYC record not found', async () => {
    const chain = { populate: jest.fn().mockReturnThis() };
    chain.populate.mockResolvedValue(null);
    SellerKyc.findById = jest.fn().mockReturnValue(chain);
    await expect(svc.getKycById(KYC_OID)).rejects.toThrow();
  });

  it('returns KYC object on success', async () => {
    const kyc = makeKyc();
    const chain = { populate: jest.fn() };
    chain.populate.mockReturnValue(chain);
    chain.then  = (res, rej) => Promise.resolve({ ...kyc, toObject: () => kyc }).then(res, rej);
    chain.catch = (rej) => Promise.resolve({ ...kyc, toObject: () => kyc }).catch(rej);
    SellerKyc.findById = jest.fn().mockReturnValue(chain);
    const result = await svc.getKycById(KYC_OID);
    expect(result._id).toBe(KYC_OID);
  });
});

// ─── approveKyc ───────────────────────────────────────────────────────────────

describe('approveKyc', () => {
  it('throws on invalid ObjectId', async () => {
    await expect(svc.approveKyc('bad-id', VALID_OID)).rejects.toThrow();
  });

  it('throws when KYC not found', async () => {
    SellerKyc.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    await expect(svc.approveKyc(KYC_OID, VALID_OID)).rejects.toThrow();
  });

  it('throws when KYC is already approved', async () => {
    const kyc = makeKyc({ status: 'approved' });
    SellerKyc.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(kyc) });
    await expect(svc.approveKyc(KYC_OID, VALID_OID)).rejects.toThrow();
  });

  it('sets status=approved, updates seller, fires notifications', async () => {
    const kyc = makeKyc();
    SellerKyc.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(kyc) });
    Seller.findByIdAndUpdate = jest.fn().mockResolvedValue({});

    const result = await svc.approveKyc(KYC_OID, VALID_OID);
    expect(kyc.status).toBe('approved');
    expect(Seller.findByIdAndUpdate).toHaveBeenCalledWith(
      SELLER_OID,
      { isVerified: true, sellerStatus: 'Verified' }
    );
    expect(result._id).toBe(KYC_OID);
  });
});

// ─── rejectKyc ────────────────────────────────────────────────────────────────

describe('rejectKyc', () => {
  it('throws on invalid ObjectId', async () => {
    await expect(svc.rejectKyc('bad-id', VALID_OID)).rejects.toThrow();
  });

  it('throws when KYC not found', async () => {
    SellerKyc.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    await expect(svc.rejectKyc(KYC_OID, VALID_OID, 'reason')).rejects.toThrow();
  });

  it('throws when KYC is already approved', async () => {
    const kyc = makeKyc({ status: 'approved' });
    SellerKyc.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(kyc) });
    await expect(svc.rejectKyc(KYC_OID, VALID_OID, 'reason')).rejects.toThrow();
  });

  it('sets status=rejected with reason and updates seller to Unverified', async () => {
    const kyc = makeKyc();
    SellerKyc.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(kyc) });
    Seller.findByIdAndUpdate = jest.fn().mockResolvedValue({});

    await svc.rejectKyc(KYC_OID, VALID_OID, 'Missing ID');
    expect(kyc.status).toBe('rejected');
    expect(kyc.rejectionReason).toBe('Missing ID');
    expect(Seller.findByIdAndUpdate).toHaveBeenCalledWith(
      SELLER_OID,
      { isVerified: false, sellerStatus: 'Unverified' }
    );
  });

  it('uses null rejectionReason when no reason provided', async () => {
    const kyc = makeKyc();
    SellerKyc.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(kyc) });
    Seller.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    await svc.rejectKyc(KYC_OID, VALID_OID);
    expect(kyc.rejectionReason).toBeNull();
  });
});
