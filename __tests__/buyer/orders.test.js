/**
 * Unit tests — buyerOrderService (read + cancel paths)
 * createOrder is covered in orderNotifications.test.js
 * Covers: retrieveBuyerOrders, retrieveOrderById, buyerCancelOrder
 */

const { makeOrder, makeBuyer, ORDER_OID, BUYER_OID } = require('../helpers/factories');

jest.mock('../../src/Buyer/models/buyerOrderModel');
jest.mock('../../src/Buyer/models/buyerAuthModel');
jest.mock('../../src/models/productModel', () => ({ Product: { findByIdAndUpdate: jest.fn() } }));
jest.mock('../../src/models/sellerModel');
jest.mock('../../src/Buyer/models/buyerNotificationModel');
jest.mock('../../src/models/sellerNotificationModel');
jest.mock('../../src/utils/notificationService', () =>
  jest.fn().mockReturnValue({ create: jest.fn().mockResolvedValue({}) })
);
jest.mock('../../src/utils/emailService', () => ({}));
jest.mock('../../src/Buyer/Service/adminControlledFxService', () => ({
  getFxRateNGNtoUSD: jest.fn().mockResolvedValue(0.00065),
}));
jest.mock('../../src/Buyer/helper/dbHelper', () => ({
  formatMongoData: (d) => ({ ...d }),
  checkObjectId:   jest.fn(),
}));
jest.mock('../../src/Buyer/constants', () => ({
  buyerOrderMessage: {
    INVALID_ORDER_ID:         'Invalid order ID',
    UNAUTHORIZED_ORDER:       'Order not found or not authorized to cancel this order',
    CANCELLATION_NOT_ALLOWED: 'Order cannot be cancelled at this stage',
  },
  CartMessage: {},
}));
jest.mock('stripe', () => () => ({
  refunds: { create: jest.fn().mockResolvedValue({}) },
}));

const Order = require('../../src/Buyer/models/buyerOrderModel');
const svc   = require('../../src/Buyer/Service/buyerOrderService');

function populateChain(value) {
  const chain = { populate: jest.fn() };
  chain.populate.mockReturnValue(chain);
  chain.then  = (resolve, reject) => Promise.resolve(value).then(resolve, reject);
  chain.catch = (reject) => Promise.resolve(value).catch(reject);
  return chain;
}

beforeEach(() => jest.clearAllMocks());

// ─── retrieveBuyerOrders ─────────────────────────────────────────────────────

describe('retrieveBuyerOrders', () => {
  it('returns paginated orders for a buyer', async () => {
    const order = makeOrder();
    const chain = {
      populate: jest.fn().mockReturnThis(),
      sort:     jest.fn().mockReturnThis(),
      skip:     jest.fn().mockReturnThis(),
      limit:    jest.fn().mockResolvedValue([{ ...order, toObject: () => order }]),
    };
    Order.find           = jest.fn().mockReturnValue(chain);
    Order.countDocuments = jest.fn().mockResolvedValue(1);

    const result = await svc.retrieveBuyerOrders(BUYER_OID, { skip: 0, limit: 10 });
    expect(result.orders).toHaveLength(1);
    expect(result.pagination.totalItems).toBe(1);
  });

  it('applies orderStatus filter when provided', async () => {
    const chain = {
      populate: jest.fn().mockReturnThis(),
      sort:     jest.fn().mockReturnThis(),
      skip:     jest.fn().mockReturnThis(),
      limit:    jest.fn().mockResolvedValue([]),
    };
    Order.find           = jest.fn().mockReturnValue(chain);
    Order.countDocuments = jest.fn().mockResolvedValue(0);

    await svc.retrieveBuyerOrders(BUYER_OID, { orderStatus: 'completed' });
    expect(Order.find).toHaveBeenCalledWith(
      expect.objectContaining({ userId: BUYER_OID, orderStatus: 'completed' })
    );
  });

  it('returns empty list when buyer has no orders', async () => {
    const chain = {
      populate: jest.fn().mockReturnThis(),
      sort:     jest.fn().mockReturnThis(),
      skip:     jest.fn().mockReturnThis(),
      limit:    jest.fn().mockResolvedValue([]),
    };
    Order.find           = jest.fn().mockReturnValue(chain);
    Order.countDocuments = jest.fn().mockResolvedValue(0);

    const result = await svc.retrieveBuyerOrders(BUYER_OID, {});
    expect(result.orders).toHaveLength(0);
  });
});

// ─── retrieveOrderById ────────────────────────────────────────────────────────

describe('retrieveOrderById (buyer)', () => {
  it('throws when order not found', async () => {
    Order.findOne = jest.fn().mockReturnValue(populateChain(null));
    await expect(svc.retrieveOrderById(ORDER_OID, BUYER_OID)).rejects.toThrow();
  });

  it('returns formatted order on success', async () => {
    const order = makeOrder();
    Order.findOne = jest.fn().mockReturnValue(populateChain(order));
    const result = await svc.retrieveOrderById(ORDER_OID, BUYER_OID);
    expect(result).toBeDefined();
  });
});

// ─── buyerCancelOrder ─────────────────────────────────────────────────────────

describe('buyerCancelOrder', () => {
  it('throws when order not found', async () => {
    Order.findOne = jest.fn().mockResolvedValue(null);
    await expect(svc.buyerCancelOrder(ORDER_OID, BUYER_OID)).rejects.toThrow();
  });

  it('throws when order status is not cancellable', async () => {
    Order.findOne = jest.fn().mockResolvedValue(makeOrder({ orderStatus: 'completed', paymentStatus: 'unpaid' }));
    await expect(svc.buyerCancelOrder(ORDER_OID, BUYER_OID)).rejects.toThrow();
  });

  it('throws when order is already cancelled', async () => {
    Order.findOne = jest.fn().mockResolvedValue(makeOrder({ orderStatus: 'canceled', paymentStatus: 'unpaid' }));
    await expect(svc.buyerCancelOrder(ORDER_OID, BUYER_OID)).rejects.toThrow();
  });

  it('sets orderStatus=canceled and saves for cancellable orders', async () => {
    const order = makeOrder({ orderStatus: 'pending', paymentStatus: 'unpaid' });
    Order.findOne = jest.fn().mockResolvedValue(order);

    await svc.buyerCancelOrder(ORDER_OID, BUYER_OID);
    expect(order.orderStatus).toBe('canceled');
    expect(order.save).toHaveBeenCalled();
  });
});
