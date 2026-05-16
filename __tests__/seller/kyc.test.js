/**
 * Unit tests — sellerKycController (submitKyc, getMyKyc)
 * Uses mock req/res pattern — no HTTP layer needed.
 */

const { makeKyc, makeSeller, KYC_OID, SELLER_OID } = require('../helpers/factories');

jest.mock('../../src/Admin/Model/sellerKycModel');
jest.mock('../../src/utils/cloudinary', () => ({
  uploadSellerDocument: jest.fn().mockResolvedValue('https://cdn.example.com/doc.pdf'),
}));
jest.mock('../../src/Admin/constants', () => ({
  kycMessage: {
    NO_DOCUMENTS:        'No documents uploaded',
    KYC_ALREADY_APPROVED: 'KYC already approved',
    KYC_SUBMITTED:       'KYC submitted successfully',
    KYC_UPDATED:         'KYC updated successfully',
  },
}));

const SellerKyc = require('../../src/Admin/Model/sellerKycModel');
const ctrl      = require('../../src/controllers/sellerKycController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(overrides = {}) {
  return {
    seller: makeSeller(),
    files:  {},
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

// ─── submitKyc ────────────────────────────────────────────────────────────────

describe('submitKyc', () => {
  it('returns 400 when no files are uploaded', async () => {
    const res = mockRes();
    await ctrl.submitKyc(makeReq({ files: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 409 when KYC is already approved', async () => {
    const existing = makeKyc({ status: 'approved' });
    SellerKyc.findOne = jest.fn().mockResolvedValue(existing);

    const res = mockRes();
    await ctrl.submitKyc(makeReq({
      files: { governmentId: [{ buffer: Buffer.from('x'), originalname: 'id.jpg', mimetype: 'image/jpeg' }] },
    }), res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('creates new KYC record and returns 201 for first submission', async () => {
    SellerKyc.findOne = jest.fn().mockResolvedValue(null);

    const kycDoc = makeKyc({ status: 'pending' });
    SellerKyc.mockImplementation(() => kycDoc);

    const res = mockRes();
    await ctrl.submitKyc(makeReq({
      files: { governmentId: [{ buffer: Buffer.from('x'), originalname: 'id.jpg', mimetype: 'image/jpeg' }] },
    }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(kycDoc.save).toHaveBeenCalled();
  });

  it('updates existing KYC and returns 200 for resubmission', async () => {
    const existing = makeKyc({ status: 'rejected' });
    SellerKyc.findOne = jest.fn().mockResolvedValue(existing);

    const res = mockRes();
    await ctrl.submitKyc(makeReq({
      files: { proofOfAddress: [{ buffer: Buffer.from('x'), originalname: 'addr.pdf', mimetype: 'application/pdf' }] },
    }), res);

    expect(existing.status).toBe('pending');
    expect(existing.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('resets rejectionReason and reviewedAt on resubmission', async () => {
    const existing = makeKyc({ status: 'rejected', rejectionReason: 'Blurry image', reviewedAt: new Date() });
    SellerKyc.findOne = jest.fn().mockResolvedValue(existing);

    const res = mockRes();
    await ctrl.submitKyc(makeReq({
      files: { governmentId: [{ buffer: Buffer.from('x'), originalname: 'id.jpg', mimetype: 'image/jpeg' }] },
    }), res);

    expect(existing.rejectionReason).toBeNull();
    expect(existing.reviewedAt).toBeNull();
  });
});

// ─── getMyKyc ─────────────────────────────────────────────────────────────────

describe('getMyKyc', () => {
  it('returns 200 with null data when seller has no KYC record', async () => {
    SellerKyc.findOne = jest.fn().mockResolvedValue(null);

    const res = mockRes();
    await ctrl.getMyKyc(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.data).toBeNull();
  });

  it('returns 200 with KYC data when record exists', async () => {
    const kyc = makeKyc({ status: 'pending' });
    SellerKyc.findOne = jest.fn().mockResolvedValue(kyc);

    const res = mockRes();
    await ctrl.getMyKyc(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.data).toBeDefined();
    expect(body.data.status).toBe('pending');
  });

  it('returns 500 on DB error', async () => {
    SellerKyc.findOne = jest.fn().mockRejectedValue(new Error('DB failure'));

    const res = mockRes();
    await ctrl.getMyKyc(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
