/**
 * Unit tests — adminOrderService
 * Covers: retrieveAllOrders, retrieveOrderById, searchOrders, updateOrderStatus
 */

const {
  makeOrder, makeBuyer, makeSeller,
  ORDER_OID, BUYER_OID, SELLER_OID,
} = require('../helpers/factories');

jest.mock('../../src/Buyer/models/buyerOrderModel');
jest.mock('../../src/models/productModel', () => ({ Product: { findByIdAndUpdate: jest.fn() } }));
jest.mock('../../src/Buyer/models/buyerAuthModel');
jest.mock('../../src/models/sellerModel');
jest.mock('../../src/Buyer/models/buyerNotificationModel');
jest.mock('../../src/utils/notificationService', () =>
  jest.fn().mockReturnValue({ create: jest.fn().mockResolvedValue({}) })
);
jest.mock('../../src/utils/emailService', () => ({
  orderStatusUpdate: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/utils/escapeRegex', () => (s) => s);
jest.mock('../../src/Buyer/Service/adminControlledFxService', () => ({
  getFxRateNGNtoUSD: jest.fn().mockResolvedValue(0.00065),
}));
jest.mock('../../src/Admin/helper/dbHelper', () => ({
  checkObjectId: jest.fn(),
  formatMongoData: (d) => d,
}));

const Order  = require('../../src/Buyer/models/buyerOrderModel');
const Buyer  = require('../../src/Buyer/models/buyerAuthModel');
const Seller = require('../../src/models/sellerModel');
const svc    = require('../../src/Admin/services/adminOrderService');

// Helper: make a chainable Order.find mock
function chainFind(docs = []) {
  const fmtDocs = docs.map((d) => ({
    ...d,
    toObject: () => d,
  }));
  const chain = {
    populate: jest.fn().mockReturnThis(),
    sort:     jest.fn().mockReturnThis(),
    skip:     jest.fn().mockReturnThis(),
    limit:    jest.fn().mockResolvedValue(fmtDocs),
  };
  return chain;
}

beforeEach(() => jest.clearAllMocks());

// ─── retrieveAllOrders ────────────────────────────────────────────────────────

describe('retrieveAllOrders', () => {
  it('returns orders with pagination meta', async () => {
    Order.countDocuments = jest.fn().mockResolvedValue(1);
    Order.find = jest.fn().mockReturnValue(chainFind([makeOrder()]));

    const result = await svc.retrieveAllOrders({ skip: 0, limit: 10, filters: {} });
    expect(result.orders).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('applies orderStatus filter when provided', async () => {
    Order.countDocuments = jest.fn().mockResolvedValue(0);
    Order.find = jest.fn().mockReturnValue(chainFind([]));

    await svc.retrieveAllOrders({ skip: 0, limit: 10, filters: { orderStatus: 'completed' } });
    expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({ orderStatus: 'completed' }));
  });

  it('pre-looks up buyer IDs when customerName filter is provided', async () => {
    Buyer.find = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: BUYER_OID }]) });
    Order.countDocuments = jest.fn().mockResolvedValue(0);
    Order.find = jest.fn().mockReturnValue(chainFind([]));

    await svc.retrieveAllOrders({ skip: 0, limit: 10, filters: { customerName: 'Test' } });
    expect(Buyer.find).toHaveBeenCalled();
    expect(Order.find).toHaveBeenCalledWith(
      expect.objectContaining({ userId: { $in: [BUYER_OID] } })
    );
  });

  it('pre-looks up seller IDs when sellerName filter is provided', async () => {
    Seller.find = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: SELLER_OID }]) });
    Order.countDocuments = jest.fn().mockResolvedValue(0);
    Order.find = jest.fn().mockReturnValue(chainFind([]));

    await svc.retrieveAllOrders({ skip: 0, limit: 10, filters: { sellerName: 'Test' } });
    expect(Seller.find).toHaveBeenCalled();
  });

  it('returns totalPages=1 when no orders exist', async () => {
    Order.countDocuments = jest.fn().mockResolvedValue(0);
    Order.find = jest.fn().mockReturnValue(chainFind([]));

    const result = await svc.retrieveAllOrders({ skip: 0, limit: 10, filters: {} });
    expect(result.totalPages).toBe(1);
  });
});

// Helper: chain that supports N chained .populate() calls and is then awaitable
function makeChainableFind(value) {
  const chain = { populate: jest.fn() };
  chain.populate.mockReturnValue(chain);
  chain.then  = (resolve, reject) => Promise.resolve(value).then(resolve, reject);
  chain.catch = (reject) => Promise.resolve(value).catch(reject);
  return chain;
}

// ─── retrieveOrderById ────────────────────────────────────────────────────────

describe('retrieveOrderById', () => {
  it('throws when order not found', async () => {
    Order.findById = jest.fn().mockReturnValue(makeChainableFind(null));
    await expect(svc.retrieveOrderById(ORDER_OID)).rejects.toThrow();
  });

  it('returns formatted order on success', async () => {
    const order = makeOrder();
    Order.findById = jest.fn().mockReturnValue(makeChainableFind(order));

    const result = await svc.retrieveOrderById(ORDER_OID);
    expect(result).toHaveProperty('orderId');
    expect(result).toHaveProperty('orderStatus', 'pending');
  });

  it('includes sellerNames array from product list', async () => {
    const order = makeOrder();
    Order.findById = jest.fn().mockReturnValue(makeChainableFind(order));

    const result = await svc.retrieveOrderById(ORDER_OID);
    expect(Array.isArray(result.sellerNames)).toBe(true);
  });
});

// ─── searchOrders ─────────────────────────────────────────────────────────────

describe('searchOrders', () => {
  it('returns all orders when searchTerm is empty', async () => {
    Order.countDocuments = jest.fn().mockResolvedValue(2);
    Order.find = jest.fn().mockReturnValue(chainFind([makeOrder(), makeOrder()]));

    const result = await svc.searchOrders({ searchTerm: '', skip: 0, limit: 10 });
    expect(result.orders).toHaveLength(2);
  });

  it('searches across buyer name, seller name, and order status', async () => {
    Buyer.find  = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: BUYER_OID }]) });
    Seller.find = jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: SELLER_OID }]) });
    Order.countDocuments = jest.fn().mockResolvedValue(0);
    Order.find = jest.fn().mockReturnValue(chainFind([]));

    await svc.searchOrders({ searchTerm: 'test', skip: 0, limit: 10 });
    expect(Buyer.find).toHaveBeenCalled();
    expect(Seller.find).toHaveBeenCalled();
    expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }));
  });
});

// ─── updateOrderStatus ────────────────────────────────────────────────────────

describe('updateOrderStatus', () => {
  it('throws when order not found', async () => {
    Order.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    await expect(svc.updateOrderStatus(ORDER_OID, 'completed')).rejects.toThrow();
  });

  it('updates order status and returns previous + new status', async () => {
    const order = makeOrder({ orderStatus: 'pending' });
    Order.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(order) });
    Order.updateOne = jest.fn().mockResolvedValue({});

    const result = await svc.updateOrderStatus(ORDER_OID, 'processing');
    expect(result.previousStatus).toBe('pending');
    expect(result.orderStatus).toBe('processing');
    expect(Order.updateOne).toHaveBeenCalledWith(
      { _id: ORDER_OID },
      { $set: { orderStatus: 'processing' } }
    );
  });

  it('fires email and notification asynchronously (does not throw)', async () => {
    const order = makeOrder();
    Order.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(order) });
    Order.updateOne = jest.fn().mockResolvedValue({});
    await expect(svc.updateOrderStatus(ORDER_OID, 'completed')).resolves.not.toThrow();
  });

  test.each([
    ['processing'],
    ['pending_logistics'],
    ['completed'],
    ['canceled'],
    ['on-hold'],
  ])('handles status "%s" without throwing', async (status) => {
    const order = makeOrder();
    Order.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(order) });
    Order.updateOne = jest.fn().mockResolvedValue({});
    await expect(svc.updateOrderStatus(ORDER_OID, status)).resolves.not.toThrow();
  });
});
