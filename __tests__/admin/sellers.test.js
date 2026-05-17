/**
 * Unit tests — adminSellerService
 * Covers: getAllSellers, getSellerById, deleteSeller, filterSellers
 */

const { makeSeller, SELLER_OID } = require('../helpers/factories');

jest.mock('../../src/models/sellerModel');
jest.mock('../../src/models/productModel', () => ({
  Product: { countDocuments: jest.fn() },
}));
jest.mock('../../src/Admin/helper/dbHelper', () => ({
  checkObjectId:   jest.fn(),
  formatMongoData: (d) => ({ ...d }),
}));

const Seller       = require('../../src/models/sellerModel');
const { Product }  = require('../../src/models/productModel');
const mongoFormat  = require('../../src/Admin/helper/dbHelper');
const svc          = require('../../src/Admin/services/adminSellerService');

function chainFind(docs = []) {
  const chain = {
    limit:    jest.fn().mockReturnThis(),
    skip:     jest.fn().mockReturnThis(),
    sort:     jest.fn().mockResolvedValue(docs.map((d) => ({ ...d, toObject: () => d }))),
  };
  return chain;
}

beforeEach(() => jest.clearAllMocks());

// ─── getAllSellers ────────────────────────────────────────────────────────────

describe('getAllSellers', () => {
  it('returns sellers with pagination', async () => {
    Seller.find           = jest.fn().mockReturnValue(chainFind([makeSeller()]));
    Seller.countDocuments = jest.fn().mockResolvedValue(1);

    const result = await svc.getAllSellers({ page: 1, limit: 10 });
    expect(result.sellers).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('applies $or search filter when searchTerm is provided', async () => {
    Seller.find           = jest.fn().mockReturnValue(chainFind([]));
    Seller.countDocuments = jest.fn().mockResolvedValue(0);

    await svc.getAllSellers({ searchTerm: 'Alice' });
    expect(Seller.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }));
  });

  it('uses empty query when no searchTerm', async () => {
    Seller.find           = jest.fn().mockReturnValue(chainFind([]));
    Seller.countDocuments = jest.fn().mockResolvedValue(0);

    await svc.getAllSellers({ searchTerm: '' });
    expect(Seller.find).toHaveBeenCalledWith({});
  });

  it('calculates correct totalPages', async () => {
    Seller.find           = jest.fn().mockReturnValue(chainFind(new Array(2).fill(makeSeller())));
    Seller.countDocuments = jest.fn().mockResolvedValue(20);

    const result = await svc.getAllSellers({ page: 1, limit: 2 });
    expect(result.pagination.totalPages).toBe(10);
  });
});

// ─── getSellerById ────────────────────────────────────────────────────────────

describe('getSellerById', () => {
  it('throws when seller not found', async () => {
    Seller.findById = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    await expect(svc.getSellerById(SELLER_OID)).rejects.toThrow();
  });

  it('returns formatted seller on success', async () => {
    const seller = makeSeller();
    Seller.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ ...seller, toObject: () => seller }),
    });
    const result = await svc.getSellerById(SELLER_OID);
    expect(result._id).toBe(SELLER_OID);
  });
});

// ─── deleteSeller ─────────────────────────────────────────────────────────────

describe('deleteSeller', () => {
  it('throws when seller not found', async () => {
    Seller.findById = jest.fn().mockResolvedValue(null);
    await expect(svc.deleteSeller(SELLER_OID)).rejects.toThrow();
  });

  it('deletes seller and related products', async () => {
    const seller = makeSeller();
    Seller.findById  = jest.fn().mockResolvedValue(seller);
    Seller.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
    Product.deleteMany = jest.fn().mockResolvedValue({});

    await expect(svc.deleteSeller(SELLER_OID)).resolves.not.toThrow();
    expect(Product.deleteMany).toHaveBeenCalled();
    expect(Seller.deleteOne).toHaveBeenCalledWith({ _id: SELLER_OID });
  });
});

// ─── filterSellers ────────────────────────────────────────────────────────────

describe('filterSellers', () => {
  function setupFilter(docs = []) {
    const chain = {
      sort:  jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip:  jest.fn().mockResolvedValue(docs.map((d) => ({ ...d, toObject: () => d }))),
    };
    Seller.find         = jest.fn().mockReturnValue(chain);
    Product.countDocuments = jest.fn().mockResolvedValue(docs.length);
  }

  it('applies firstName filter', async () => {
    setupFilter([makeSeller()]);
    await svc.filterSellers({ firstName: 'Test' });
    expect(Seller.find).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: expect.objectContaining({ $regex: 'Test' }) })
    );
  });

  it('applies email filter', async () => {
    setupFilter([]);
    await svc.filterSellers({ email: 'seller@test.com' });
    expect(Seller.find).toHaveBeenCalledWith(
      expect.objectContaining({ email: expect.objectContaining({ $regex: 'seller@test.com' }) })
    );
  });

  it('sorts by name_asc when sortBy=name_asc', async () => {
    const chain = {
      sort:  jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip:  jest.fn().mockResolvedValue([]),
    };
    Seller.find         = jest.fn().mockReturnValue(chain);
    Product.countDocuments = jest.fn().mockResolvedValue(0);

    await svc.filterSellers({ sortBy: 'name_asc' });
    expect(chain.sort).toHaveBeenCalledWith({ firstName: 1, lastName: 1 });
  });

  it('returns sellers and pagination', async () => {
    setupFilter([makeSeller()]);
    const result = await svc.filterSellers({ page: 1, limit: 10 });
    expect(result.sellers).toHaveLength(1);
    expect(result.pagination).toBeDefined();
  });
});
