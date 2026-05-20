/**
 * Unit tests — adminProductService
 * Covers: getAllProducts, approveProduct (approve + reject + invalid), getProductById
 */

const { makeProduct, PRODUCT_OID, VALID_OID } = require('../helpers/factories');

jest.mock('../../src/models/productModel', () => ({
  Product: {
    find:             jest.fn(),
    findById:         jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments:   jest.fn(),
  },
}));
jest.mock('../../src/models/categoryModel', () => ({ Category: {} }));
jest.mock('../../src/Buyer/Service/buyerProductService', () => ({
  syncProductsToAlgolia:   jest.fn().mockResolvedValue(undefined),
  removeProductFromAlgolia: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/Admin/helper/dbHelper', () => ({
  checkObjectId: jest.fn(),
  formatMongoData: (d) => ({ ...d }),
}));

const { Product } = require('../../src/models/productModel');
const syncProduct  = require('../../src/Buyer/Service/buyerProductService');
const svc          = require('../../src/Admin/services/adminProductService');

beforeEach(() => jest.clearAllMocks());

// ─── getAllProducts ───────────────────────────────────────────────────────────

describe('getAllProducts', () => {
  function chainFind(docs = []) {
    const chain = {
      populate: jest.fn().mockReturnThis(),
      limit:    jest.fn().mockReturnThis(),
      skip:     jest.fn().mockReturnThis(),
      sort:     jest.fn().mockResolvedValue(docs.map((d) => ({ ...d, toObject: () => d }))),
    };
    return chain;
  }

  it('returns products with pagination meta', async () => {
    Product.find           = jest.fn().mockReturnValue(chainFind([makeProduct()]));
    Product.countDocuments = jest.fn().mockResolvedValue(1);

    const result = await svc.getAllProducts({ page: 1, limit: 10 });
    expect(result.products).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('applies category filter when provided', async () => {
    Product.find           = jest.fn().mockReturnValue(chainFind([]));
    Product.countDocuments = jest.fn().mockResolvedValue(0);

    await svc.getAllProducts({ category: VALID_OID, page: 1, limit: 10 });
    expect(Product.find).toHaveBeenCalledWith(expect.objectContaining({ category: VALID_OID }));
  });

  it('applies subcategory filter when both category and subcategory are given', async () => {
    Product.find           = jest.fn().mockReturnValue(chainFind([]));
    Product.countDocuments = jest.fn().mockResolvedValue(0);

    await svc.getAllProducts({ category: VALID_OID, subcategory: VALID_OID, page: 1, limit: 10 });
    expect(Product.find).toHaveBeenCalledWith(
      expect.objectContaining({ category: VALID_OID, subcategory: VALID_OID })
    );
  });
});

// ─── approveProduct ───────────────────────────────────────────────────────────

describe('approveProduct', () => {
  it('throws when product not found', async () => {
    Product.findById = jest.fn().mockResolvedValue(null);
    await expect(svc.approveProduct(PRODUCT_OID, 'approve')).rejects.toThrow();
  });

  it('throws on invalid action', async () => {
    Product.findById = jest.fn().mockResolvedValue(makeProduct());
    await expect(svc.approveProduct(PRODUCT_OID, 'invalid')).rejects.toThrow();
  });

  describe('action=approve', () => {
    it('sets productStatus=approved and isApproved=true', async () => {
      const product = makeProduct();
      Product.findById = jest.fn().mockResolvedValue(product);

      await svc.approveProduct(PRODUCT_OID, 'approve');
      expect(product.productStatus).toBe('approved');
      expect(product.isApproved).toBe(true);
      expect(product.save).toHaveBeenCalled();
    });

    it('returns the string "approve"', async () => {
      const product = makeProduct();
      Product.findById = jest.fn().mockResolvedValue(product);
      const result = await svc.approveProduct(PRODUCT_OID, 'approve');
      expect(result).toBe('approve');
    });

    it('schedules Algolia sync asynchronously', async () => {
      const product = makeProduct();
      Product.findById = jest.fn().mockResolvedValue(product);

      await svc.approveProduct(PRODUCT_OID, 'approve');
      // Flush the setImmediate queue
      await new Promise(r => setImmediate(r));
      expect(syncProduct.syncProductsToAlgolia).toHaveBeenCalled();
    });
  });

  describe('action=reject', () => {
    it('deletes the product from DB', async () => {
      const product = makeProduct();
      Product.findById          = jest.fn().mockResolvedValue(product);
      Product.findByIdAndDelete = jest.fn().mockResolvedValue({});

      await svc.approveProduct(PRODUCT_OID, 'reject');
      expect(Product.findByIdAndDelete).toHaveBeenCalledWith(PRODUCT_OID);
    });

    it('returns the string "reject"', async () => {
      const product = makeProduct();
      Product.findById          = jest.fn().mockResolvedValue(product);
      Product.findByIdAndDelete = jest.fn().mockResolvedValue({});

      const result = await svc.approveProduct(PRODUCT_OID, 'reject');
      expect(result).toBe('reject');
    });

    it('schedules Algolia removal asynchronously', async () => {
      const product = makeProduct();
      Product.findById          = jest.fn().mockResolvedValue(product);
      Product.findByIdAndDelete = jest.fn().mockResolvedValue({});

      await svc.approveProduct(PRODUCT_OID, 'reject');
      await new Promise(r => setImmediate(r));
      expect(syncProduct.removeProductFromAlgolia).toHaveBeenCalledWith(PRODUCT_OID);
    });
  });
});

// ─── getProductById ───────────────────────────────────────────────────────────

describe('getProductById', () => {
  it('throws when product not found', async () => {
    const chain = { populate: jest.fn().mockReturnThis() };
    chain.populate.mockResolvedValue(null);
    Product.findById = jest.fn().mockReturnValue(chain);
    await expect(svc.getProductById(PRODUCT_OID)).rejects.toThrow();
  });

  it('returns formatted product on success', async () => {
    const product = makeProduct();
    const chain   = { populate: jest.fn().mockReturnThis() };
    chain.populate.mockResolvedValue({ ...product, toObject: () => product });
    Product.findById = jest.fn().mockReturnValue(chain);

    const result = await svc.getProductById(PRODUCT_OID);
    expect(result._id).toBe(PRODUCT_OID);
  });
});
