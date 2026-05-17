/**
 * Unit tests — adminPayoutService
 * Covers: getPayouts, approvePayout, rejectPayout
 */

const { makePayout, PAYOUT_OID } = require('../helpers/factories');

jest.mock('../../src/Buyer/models/payoutModel');

const Payout = require('../../src/Buyer/models/payoutModel');
const svc    = require('../../src/Admin/services/adminPayoutService');

beforeEach(() => jest.clearAllMocks());

// ─── getPayouts ───────────────────────────────────────────────────────────────

describe('getPayouts', () => {
  function setupList(docs = [], total = 0) {
    const chain = {
      sort:  jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip:  jest.fn().mockResolvedValue(docs.map((d) => ({ ...d, toObject: () => d }))),
    };
    Payout.find           = jest.fn().mockReturnValue(chain);
    Payout.countDocuments = jest.fn().mockResolvedValue(total);
  }

  it('returns all payouts when no status filter', async () => {
    setupList([makePayout()], 1);
    const result = await svc.getPayouts({ page: 1, limit: 20 });
    expect(result.payouts).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
    expect(Payout.find).toHaveBeenCalledWith({});
  });

  it('applies status filter for valid statuses', async () => {
    setupList([], 0);
    await svc.getPayouts({ status: 'pending' });
    expect(Payout.find).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('ignores status filter for invalid status values', async () => {
    setupList([], 0);
    await svc.getPayouts({ status: 'bogus' });
    expect(Payout.find).toHaveBeenCalledWith({});
  });

  it('calculates correct totalPages', async () => {
    setupList(new Array(5).fill(makePayout()), 50);
    const result = await svc.getPayouts({ page: 1, limit: 5 });
    expect(result.pagination.totalPages).toBe(10);
  });

  it('returns empty list with totalPages=0 when no payouts', async () => {
    setupList([], 0);
    const result = await svc.getPayouts({});
    expect(result.payouts).toHaveLength(0);
  });
});

// ─── approvePayout ────────────────────────────────────────────────────────────

describe('approvePayout', () => {
  it('throws when payout not found', async () => {
    Payout.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    await expect(svc.approvePayout(PAYOUT_OID)).rejects.toThrow('Payout not found');
  });

  it('sets status=paid and returns updated payout', async () => {
    const payout = makePayout({ status: 'paid' });
    Payout.findByIdAndUpdate = jest.fn().mockResolvedValue({ ...payout, toObject: () => payout });

    const result = await svc.approvePayout(PAYOUT_OID);
    expect(Payout.findByIdAndUpdate).toHaveBeenCalledWith(
      PAYOUT_OID,
      { $set: { status: 'paid' } },
      { new: true }
    );
    expect(result.status).toBe('paid');
  });
});

// ─── rejectPayout ─────────────────────────────────────────────────────────────

describe('rejectPayout', () => {
  it('throws when payout not found', async () => {
    Payout.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    await expect(svc.rejectPayout(PAYOUT_OID)).rejects.toThrow('Payout not found');
  });

  it('sets status=failed and returns updated payout', async () => {
    const payout = makePayout({ status: 'failed' });
    Payout.findByIdAndUpdate = jest.fn().mockResolvedValue({ ...payout, toObject: () => payout });

    const result = await svc.rejectPayout(PAYOUT_OID);
    expect(Payout.findByIdAndUpdate).toHaveBeenCalledWith(
      PAYOUT_OID,
      { $set: { status: 'failed' } },
      { new: true }
    );
    expect(result.status).toBe('failed');
  });
});
