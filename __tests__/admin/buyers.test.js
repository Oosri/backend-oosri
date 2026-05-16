/**
 * Unit tests — adminBuyerService
 * Covers: getAllBuyers, getBuyerById, suspendBuyer, unsuspendBuyer
 */

const { makeBuyer, BUYER_OID } = require('../helpers/factories');

jest.mock('../../src/Buyer/models/buyerAuthModel');
jest.mock('../../src/Admin/helper/dbHelper', () => ({
  checkObjectId:   jest.fn(),
  formatMongoData: (d) => ({ ...d }),
}));

const Buyer = require('../../src/Buyer/models/buyerAuthModel');
const svc   = require('../../src/Admin/services/adminBuyerService');

function selectChain(value) {
  return { select: jest.fn().mockResolvedValue(value) };
}

beforeEach(() => jest.clearAllMocks());

// ─── getAllBuyers ─────────────────────────────────────────────────────────────

describe('getAllBuyers', () => {
  it('returns all buyers with pagination', async () => {
    const buyer = makeBuyer();
    const chain = {
      select: jest.fn().mockReturnThis(),
      sort:   jest.fn().mockReturnThis(),
      limit:  jest.fn().mockReturnThis(),
      skip:   jest.fn().mockResolvedValue([{ ...buyer, toObject: () => buyer }]),
    };
    Buyer.find           = jest.fn().mockReturnValue(chain);
    Buyer.countDocuments = jest.fn().mockResolvedValue(1);

    const result = await svc.getAllBuyers({ page: 1, limit: 20 });
    expect(result.buyers).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('applies search filter when searchTerm is provided', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      sort:   jest.fn().mockReturnThis(),
      limit:  jest.fn().mockReturnThis(),
      skip:   jest.fn().mockResolvedValue([]),
    };
    Buyer.find           = jest.fn().mockReturnValue(chain);
    Buyer.countDocuments = jest.fn().mockResolvedValue(0);

    await svc.getAllBuyers({ searchTerm: 'Alice' });
    expect(Buyer.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }));
  });

  it('returns empty buyers array with totalPages=1 when no results', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      sort:   jest.fn().mockReturnThis(),
      limit:  jest.fn().mockReturnThis(),
      skip:   jest.fn().mockResolvedValue([]),
    };
    Buyer.find           = jest.fn().mockReturnValue(chain);
    Buyer.countDocuments = jest.fn().mockResolvedValue(0);

    const result = await svc.getAllBuyers({});
    expect(result.buyers).toHaveLength(0);
    expect(result.pagination.totalPages).toBe(0);
  });
});

// ─── getBuyerById ─────────────────────────────────────────────────────────────

describe('getBuyerById', () => {
  it('throws when buyer not found', async () => {
    Buyer.findById = jest.fn().mockReturnValue(selectChain(null));
    await expect(svc.getBuyerById(BUYER_OID)).rejects.toThrow('Buyer not found');
  });

  it('returns formatted buyer on success', async () => {
    const buyer = makeBuyer();
    Buyer.findById = jest.fn().mockReturnValue(
      selectChain({ ...buyer, toObject: () => buyer })
    );
    const result = await svc.getBuyerById(BUYER_OID);
    expect(result._id).toBe(BUYER_OID);
  });
});

// ─── suspendBuyer ─────────────────────────────────────────────────────────────

describe('suspendBuyer', () => {
  it('throws when buyer not found', async () => {
    Buyer.findByIdAndUpdate = jest.fn().mockReturnValue(selectChain(null));
    await expect(svc.suspendBuyer(BUYER_OID, 'spam')).rejects.toThrow('Buyer not found');
  });

  it('sets isSuspended=true with the provided reason', async () => {
    const buyer = makeBuyer({ isSuspended: true, suspensionReason: 'spam' });
    Buyer.findByIdAndUpdate = jest.fn().mockReturnValue(
      selectChain({ ...buyer, toObject: () => buyer })
    );
    const result = await svc.suspendBuyer(BUYER_OID, 'spam');
    expect(Buyer.findByIdAndUpdate).toHaveBeenCalledWith(
      BUYER_OID,
      { $set: { isSuspended: true, suspensionReason: 'spam' } },
      { new: true }
    );
    expect(result.isSuspended).toBe(true);
  });

  it('uses default reason "Admin action" when no reason given', async () => {
    const buyer = makeBuyer({ isSuspended: true });
    Buyer.findByIdAndUpdate = jest.fn().mockReturnValue(
      selectChain({ ...buyer, toObject: () => buyer })
    );
    await svc.suspendBuyer(BUYER_OID);
    expect(Buyer.findByIdAndUpdate).toHaveBeenCalledWith(
      BUYER_OID,
      { $set: { isSuspended: true, suspensionReason: 'Admin action' } },
      { new: true }
    );
  });
});

// ─── unsuspendBuyer ───────────────────────────────────────────────────────────

describe('unsuspendBuyer', () => {
  it('throws when buyer not found', async () => {
    Buyer.findByIdAndUpdate = jest.fn().mockReturnValue(selectChain(null));
    await expect(svc.unsuspendBuyer(BUYER_OID)).rejects.toThrow('Buyer not found');
  });

  it('unsets isSuspended and suspensionReason', async () => {
    const buyer = makeBuyer();
    Buyer.findByIdAndUpdate = jest.fn().mockReturnValue(
      selectChain({ ...buyer, toObject: () => buyer })
    );
    await svc.unsuspendBuyer(BUYER_OID);
    expect(Buyer.findByIdAndUpdate).toHaveBeenCalledWith(
      BUYER_OID,
      { $unset: { isSuspended: '', suspensionReason: '' } },
      { new: true }
    );
  });
});
