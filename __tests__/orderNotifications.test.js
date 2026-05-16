/**
 * Unit tests for in-app notifications wired into order events.
 * All DB calls are mocked — no real MongoDB connection needed.
 */

const VALID_OID = '507f1f77bcf86cd799439011';
const SELLER_OID = '507f191e810c19729de860ea';
const BUYER_OID  = '507f1f77bcf86cd799439022';
const ORDER_OID  = '507f1f77bcf86cd799439033';

// ─── 1. createNotificationService factory ─────────────────────────────────────

describe('createNotificationService factory', () => {
  // Use the real module — it only touches the Model it's given
  const createNotificationService = require('../src/utils/notificationService');

  function mockModel() {
    const M = jest.fn();
    M.find          = jest.fn();
    M.countDocuments = jest.fn();
    M.findOneAndUpdate = jest.fn();
    M.updateMany    = jest.fn();
    M.findOneAndDelete = jest.fn();
    return M;
  }

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('saves a doc and sets the ownerField correctly', async () => {
      const saved = { sellerId: VALID_OID, type: 'new_order', title: 'T', message: 'M', metadata: {} };
      const mockSave = jest.fn().mockResolvedValue(undefined);
      const M = jest.fn().mockImplementation((data) => ({ ...data, save: mockSave, toObject: () => data }));

      const svc = createNotificationService(M, 'sellerId');
      await svc.create({ ownerId: VALID_OID, type: 'new_order', title: 'T', message: 'M' });

      expect(M).toHaveBeenCalledWith(expect.objectContaining({ sellerId: VALID_OID, type: 'new_order' }));
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it('defaults metadata to {} when omitted', async () => {
      let captured = null;
      const M = jest.fn().mockImplementation((data) => {
        captured = data;
        return { ...data, save: jest.fn().mockResolvedValue(undefined), toObject: () => data };
      });

      const svc = createNotificationService(M, 'buyerId');
      await svc.create({ ownerId: VALID_OID, type: 'order_placed', title: 'T', message: 'M' });

      expect(captured.metadata).toEqual({});
    });

    it('propagates DB save errors', async () => {
      const M = jest.fn().mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('write conflict')),
        toObject: jest.fn(),
      }));

      const svc = createNotificationService(M, 'buyerId');
      await expect(
        svc.create({ ownerId: VALID_OID, type: 'system', title: 'T', message: 'M' })
      ).rejects.toThrow('write conflict');
    });
  });

  // ── getAll ───────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns notifications, total, and unreadCount', async () => {
      const docs = [
        { _id: 'a', type: 'order_placed', title: 'T1', message: 'M1', isRead: false },
        { _id: 'b', type: 'order_shipped', title: 'T2', message: 'M2', isRead: true },
      ];
      const M = mockModel();
      M.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(docs),
      });
      M.countDocuments = jest.fn()
        .mockResolvedValueOnce(2)   // total
        .mockResolvedValueOnce(1);  // unreadCount

      const svc = createNotificationService(M, 'buyerId');
      const result = await svc.getAll({ ownerId: BUYER_OID });

      expect(result.notifications).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.unreadCount).toBe(1);
    });

    it('scopes find and countDocuments to the correct owner', async () => {
      const M = mockModel();
      M.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      M.countDocuments = jest.fn().mockResolvedValue(0);

      const svc = createNotificationService(M, 'sellerId');
      await svc.getAll({ ownerId: SELLER_OID, skip: 5, limit: 10 });

      expect(M.find).toHaveBeenCalledWith({ sellerId: SELLER_OID });
      expect(M.countDocuments).toHaveBeenCalledWith({ sellerId: SELLER_OID });
    });

    it('passes skip and limit to the query chain', async () => {
      const mockSkip  = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const M = mockModel();
      M.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(), skip: mockSkip, limit: mockLimit,
        lean: jest.fn().mockResolvedValue([]),
      });
      M.countDocuments = jest.fn().mockResolvedValue(0);

      const svc = createNotificationService(M, 'buyerId');
      await svc.getAll({ ownerId: BUYER_OID, skip: 20, limit: 5 });

      expect(mockSkip).toHaveBeenCalledWith(20);
      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it('maps _id → id and strips __v from each notification', async () => {
      const M = mockModel();
      M.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: 'abc123', type: 'system', __v: 0 }]),
      });
      M.countDocuments = jest.fn().mockResolvedValue(1);

      const svc = createNotificationService(M, 'buyerId');
      const { notifications } = await svc.getAll({ ownerId: BUYER_OID });

      expect(notifications[0].id).toBe('abc123');
      expect(notifications[0]._id).toBeUndefined();
      expect(notifications[0].__v).toBeUndefined();
    });
  });

  // ── markRead ─────────────────────────────────────────────────────────────────

  describe('markRead', () => {
    it('calls findOneAndUpdate scoped to owner + notification id', async () => {
      const M = mockModel();
      M.findOneAndUpdate = jest.fn().mockResolvedValue({
        isRead: true, toObject: () => ({ isRead: true }),
      });

      const svc = createNotificationService(M, 'buyerId');
      await svc.markRead({ ownerId: BUYER_OID, notificationId: VALID_OID });

      expect(M.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: VALID_OID, buyerId: BUYER_OID },
        { $set: { isRead: true } },
        { new: true }
      );
    });

    it('throws "Invalid notification id" for a bad ObjectId', async () => {
      const M = mockModel();
      const svc = createNotificationService(M, 'buyerId');
      await expect(
        svc.markRead({ ownerId: BUYER_OID, notificationId: 'not-an-id' })
      ).rejects.toThrow('Invalid notification id');
      expect(M.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('throws "Notification not found" when no document matches', async () => {
      const M = mockModel();
      M.findOneAndUpdate = jest.fn().mockResolvedValue(null);

      const svc = createNotificationService(M, 'buyerId');
      await expect(
        svc.markRead({ ownerId: BUYER_OID, notificationId: VALID_OID })
      ).rejects.toThrow('Notification not found');
    });
  });

  // ── markAllRead ───────────────────────────────────────────────────────────────

  describe('markAllRead', () => {
    it('calls updateMany scoped to owner with isRead: false filter', async () => {
      const M = mockModel();
      M.updateMany = jest.fn().mockResolvedValue({});

      const svc = createNotificationService(M, 'sellerId');
      await svc.markAllRead({ ownerId: SELLER_OID });

      expect(M.updateMany).toHaveBeenCalledWith(
        { sellerId: SELLER_OID, isRead: false },
        { $set: { isRead: true } }
      );
    });
  });

  // ── deleteOne ────────────────────────────────────────────────────────────────

  describe('deleteOne', () => {
    it('calls findOneAndDelete scoped to owner + notification id', async () => {
      const M = mockModel();
      M.findOneAndDelete = jest.fn().mockResolvedValue({ _id: VALID_OID });

      const svc = createNotificationService(M, 'buyerId');
      await svc.deleteOne({ ownerId: BUYER_OID, notificationId: VALID_OID });

      expect(M.findOneAndDelete).toHaveBeenCalledWith({ _id: VALID_OID, buyerId: BUYER_OID });
    });

    it('throws "Invalid notification id" for a bad ObjectId', async () => {
      const M = mockModel();
      const svc = createNotificationService(M, 'buyerId');
      await expect(
        svc.deleteOne({ ownerId: BUYER_OID, notificationId: 'bad-id' })
      ).rejects.toThrow('Invalid notification id');
      expect(M.findOneAndDelete).not.toHaveBeenCalled();
    });

    it('throws "Notification not found" when no document matches', async () => {
      const M = mockModel();
      M.findOneAndDelete = jest.fn().mockResolvedValue(null);

      const svc = createNotificationService(M, 'buyerId');
      await expect(
        svc.deleteOne({ ownerId: BUYER_OID, notificationId: VALID_OID })
      ).rejects.toThrow('Notification not found');
    });
  });
});

// ─── 2. adminOrderService.updateOrderStatus — notification mapping ─────────────

describe('adminOrderService.updateOrderStatus — buyer notification', () => {
  beforeEach(() => { jest.resetModules(); });

  function buildMocks(notifCreate = jest.fn().mockResolvedValue({})) {
    const mockOrder = {
      _id: ORDER_OID,
      orderStatus: 'pending',
      userId: { _id: BUYER_OID, email: 'buyer@test.com', fullName: 'Test Buyer' },
    };

    jest.doMock('../src/Buyer/models/buyerOrderModel', () => {
      const M = jest.fn();
      M.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(mockOrder) });
      M.updateOne = jest.fn().mockResolvedValue({});
      return M;
    });
    jest.doMock('../src/models/productModel', () => ({ Product: jest.fn() }));
    jest.doMock('../src/Admin/helper/dbHelper', () => ({
      checkObjectId: jest.fn(),
    }));
    jest.doMock('../src/utils/emailService', () => ({
      orderStatusUpdate: jest.fn().mockResolvedValue(undefined),
    }));
    jest.doMock('../src/Buyer/models/buyerAuthModel', () => jest.fn());
    jest.doMock('../src/Buyer/Service/adminControlledFxService', () => ({
      getFxRateNGNtoUSD: jest.fn().mockResolvedValue(0.00065),
    }));
    jest.doMock('../src/Buyer/models/buyerNotificationModel', () => jest.fn());
    jest.doMock('../src/utils/notificationService', () =>
      jest.fn().mockReturnValue({ create: notifCreate })
    );
    jest.doMock('../src/Admin/constants', () => ({
      customServerResponse: { status: 500, message: '', body: null },
      adminOrderMessage: {
        INVALID_ORDER_ID: 'Order not found',
        ORDER_STATUS_UPDATED: 'Order status updated',
      },
    }));

    const { updateOrderStatus } = require('../src/Admin/services/adminOrderService');
    return { updateOrderStatus, notifCreate };
  }

  const STATUS_CASES = [
    ['processing',        'order_placed',    'Order Confirmed'],
    ['pending_logistics', 'order_shipped',   'Order Shipped'],
    ['completed',         'order_delivered', 'Order Delivered'],
    ['canceled',          'order_cancelled', 'Order Cancelled'],
    ['on-hold',           'system',          'Order On Hold'],
  ];

  test.each(STATUS_CASES)(
    'status "%s" fires notification type "%s" with title "%s"',
    async (newStatus, expectedType, expectedTitle) => {
      const { updateOrderStatus, notifCreate } = buildMocks();
      await updateOrderStatus(ORDER_OID, newStatus);
      await new Promise((r) => setImmediate(r));

      expect(notifCreate).toHaveBeenCalledWith(
        expect.objectContaining({ type: expectedType, title: expectedTitle })
      );
    }
  );

  it('falls back to system type for an unknown status', async () => {
    const { updateOrderStatus, notifCreate } = buildMocks();
    await updateOrderStatus(ORDER_OID, 'in_review');
    await new Promise((r) => setImmediate(r));

    expect(notifCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'system' })
    );
  });

  it('includes the orderId in the notification metadata', async () => {
    const { updateOrderStatus, notifCreate } = buildMocks();
    await updateOrderStatus(ORDER_OID, 'completed');
    await new Promise((r) => setImmediate(r));

    expect(notifCreate).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ orderId: ORDER_OID }) })
    );
  });

  it('resolves successfully even when notification throws', async () => {
    const failingCreate = jest.fn().mockRejectedValue(new Error('DB down'));
    const { updateOrderStatus } = buildMocks(failingCreate);

    await expect(updateOrderStatus(ORDER_OID, 'completed')).resolves.toBeDefined();
    await new Promise((r) => setImmediate(r));
  });

  it('resolves successfully even when email throws', async () => {
    const { updateOrderStatus } = buildMocks();

    jest.resetModules();

    // Rebuild with a failing email mock
    const failCreate = jest.fn().mockResolvedValue({});
    jest.doMock('../src/Buyer/models/buyerOrderModel', () => {
      const M = jest.fn();
      M.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: ORDER_OID, orderStatus: 'pending',
          userId: { _id: BUYER_OID, email: 'b@test.com', fullName: 'Buyer' },
        }),
      });
      M.updateOne = jest.fn().mockResolvedValue({});
      return M;
    });
    jest.doMock('../src/models/productModel', () => ({ Product: jest.fn() }));
    jest.doMock('../src/Admin/helper/dbHelper', () => ({ checkObjectId: jest.fn() }));
    jest.doMock('../src/utils/emailService', () => ({
      orderStatusUpdate: jest.fn().mockRejectedValue(new Error('SMTP error')),
    }));
    jest.doMock('../src/Buyer/models/buyerAuthModel', () => jest.fn());
    jest.doMock('../src/Buyer/Service/adminControlledFxService', () => ({
      getFxRateNGNtoUSD: jest.fn(),
    }));
    jest.doMock('../src/Buyer/models/buyerNotificationModel', () => jest.fn());
    jest.doMock('../src/utils/notificationService', () =>
      jest.fn().mockReturnValue({ create: failCreate })
    );
    jest.doMock('../src/Admin/constants', () => ({
      customServerResponse: { status: 500, message: '', body: null },
      adminOrderMessage: { INVALID_ORDER_ID: 'Not found', ORDER_STATUS_UPDATED: 'Updated' },
    }));

    const { updateOrderStatus: uos } = require('../src/Admin/services/adminOrderService');
    await expect(uos(ORDER_OID, 'completed')).resolves.toBeDefined();
    await new Promise((r) => setImmediate(r));
  });
});

// ─── 3. buyerOrderService.buyerCancelOrder — cancellation notification ─────────

describe('buyerOrderService.buyerCancelOrder — cancellation notification', () => {
  beforeEach(() => { jest.resetModules(); });

  function buildMocks({ notifCreate = jest.fn().mockResolvedValue({}), orderDoc } = {}) {
    const defaultOrder = {
      _id: ORDER_OID,
      userId: BUYER_OID,
      orderStatus: 'pending',
      paymentStatus: 'pending',
      paymentIntentId: null,
      save: jest.fn().mockResolvedValue({ orderStatus: 'canceled' }),
    };
    const mockOrder = orderDoc !== undefined ? orderDoc : defaultOrder;

    jest.doMock('../src/Buyer/models/buyerOrderModel', () => {
      const M = jest.fn();
      M.findOne = jest.fn().mockResolvedValue(mockOrder);
      return M;
    });
    jest.doMock('../src/models/productModel', () => ({ Product: jest.fn() }));
    jest.doMock('../src/Buyer/helper/dbHelper', () => ({ checkObjectId: jest.fn() }));
    jest.doMock('../src/Buyer/constants', () => ({
      buyerOrderMessage: {
        UNAUTHORIZED_ORDER: 'Unauthorized',
        CANCELLATION_NOT_ALLOWED: 'Cannot cancel',
      },
    }));
    jest.doMock('../src/utils/emailService', () => ({}));
    jest.doMock('../src/Buyer/models/buyerAuthModel', () => jest.fn());
    jest.doMock('../src/Buyer/models/buyerCartModel', () => jest.fn());
    jest.doMock('../src/models/sellerModel', () => jest.fn());
    jest.doMock('../src/Buyer/Service/adminControlledFxService', () => ({
      getFxRateNGNtoUSD: jest.fn(),
    }));
    jest.doMock('../src/Buyer/models/buyerNotificationModel', () => jest.fn());
    jest.doMock('../src/models/sellerNotificationModel', () => jest.fn());
    jest.doMock('../src/utils/notificationService', () =>
      jest.fn().mockReturnValue({ create: notifCreate })
    );
    jest.doMock('moment', () => jest.fn(() => ({ format: jest.fn().mockReturnValue('2024-01-01') })));

    const svc = require('../src/Buyer/Service/buyerOrderService');
    return { svc, notifCreate };
  }

  it('fires an order_cancelled notification to the buyer', async () => {
    const { svc, notifCreate } = buildMocks();
    await svc.buyerCancelOrder(ORDER_OID, BUYER_OID);
    await new Promise((r) => setImmediate(r));

    expect(notifCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order_cancelled', ownerId: BUYER_OID })
    );
  });

  it('includes the orderId in the notification metadata', async () => {
    const { svc, notifCreate } = buildMocks();
    await svc.buyerCancelOrder(ORDER_OID, BUYER_OID);
    await new Promise((r) => setImmediate(r));

    expect(notifCreate).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ orderId: ORDER_OID }) })
    );
  });

  it('still returns the cancelled status when notification throws', async () => {
    const failCreate = jest.fn().mockRejectedValue(new Error('DB error'));
    const { svc } = buildMocks(failCreate);

    const result = await svc.buyerCancelOrder(ORDER_OID, BUYER_OID);
    await new Promise((r) => setImmediate(r));

    expect(result).toBe('canceled');
  });

  it('does not fire notification when order is not found', async () => {
    const notifCreate = jest.fn();
    const { svc } = buildMocks({ notifCreate, orderDoc: null });

    await expect(svc.buyerCancelOrder(ORDER_OID, BUYER_OID)).rejects.toThrow();
    await new Promise((r) => setImmediate(r));
    expect(notifCreate).not.toHaveBeenCalled();
  });
});

// ─── 4. buyerOrderService.createOrder — order_placed + new_order ──────────────

describe('buyerOrderService.createOrder — order placed notifications', () => {
  beforeEach(() => { jest.resetModules(); });

  function buildOrderMocks({ notifCreate = jest.fn().mockResolvedValue({}) } = {}) {
    const SELLER_A = '507f1f77bcf86cd799430001';
    const SELLER_B = '507f1f77bcf86cd799430002';

    const mockSession = {
      startTransaction:  jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction:  jest.fn().mockResolvedValue(undefined),
      endSession:        jest.fn(),
    };

    const mockProduct = (sellerId) => ({
      _id: `prod-${sellerId}`,
      productName: `Product-${sellerId}`,
      salesPrice: 0,
      regularPrice: 1000,
      images: [],
      inStock: 10,
      lowStockThreshold: 5,
      productStatus: 'approved',
      isVisible: true,
      seller: { _id: sellerId },
    });

    const mockCart = {
      _id: 'cart-1',
      userId: BUYER_OID,
      items: [
        { productId: mockProduct(SELLER_A), quantity: 1 },
        { productId: mockProduct(SELLER_B), quantity: 2 },
      ],
    };

    const savedOrderDoc = {
      _id: ORDER_OID,
      products: mockCart.items.map(i => ({
        productId: i.productId,
        productName: i.productId.productName,
        images: [],
        price: 1000,
        quantity: i.quantity,
        totalPrice: 1000 * i.quantity,
        sellerId: { _id: i.productId.seller._id },
      })),
      toObject: jest.fn().mockReturnValue({}),
    };

    jest.doMock('mongoose', () => ({
      ...jest.requireActual('mongoose'),
      startSession: jest.fn().mockResolvedValue(mockSession),
    }));

    jest.doMock('../src/Buyer/models/buyerCartModel', () => {
      const M = jest.fn();
      M.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart),
      });
      M.findByIdAndDelete = jest.fn().mockResolvedValue({});
      return M;
    });

    jest.doMock('../src/models/productModel', () => {
      const ProductMock = jest.fn();
      ProductMock.findById = jest.fn().mockImplementation((id) => ({
        session: jest.fn().mockResolvedValue(mockProduct(String(id))),
      }));
      ProductMock.findOneAndUpdate = jest.fn().mockResolvedValue({
        inStock: 9, lowStockThreshold: 5,
      });
      ProductMock.updateOne = jest.fn().mockResolvedValue({});
      return { Product: ProductMock };
    });

    jest.doMock('../src/Buyer/models/buyerOrderModel', () => {
      const M = jest.fn().mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(savedOrderDoc),
      }));
      M.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(savedOrderDoc),
      });
      return M;
    });

    jest.doMock('../src/Buyer/models/buyerAuthModel', () => {
      const buyerDoc = {
        _id: BUYER_OID,
        email: 'buyer@test.com',
        fullName: 'Test Buyer',
        deliveryAddresses: [],
        save: jest.fn().mockResolvedValue(undefined),
      };
      const M = jest.fn();
      // First call uses .select('email fullName deliveryAddresses')
      // Second call (save address) is awaited directly
      M.findById = jest.fn()
        .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(buyerDoc) })
        .mockResolvedValue(buyerDoc);
      return M;
    });

    jest.doMock('../src/models/sellerModel', () => {
      const M = jest.fn();
      M.findById = jest.fn().mockResolvedValue({ email: 's@test.com', firstName: 'S', lastName: 'L' });
      return M;
    });

    jest.doMock('../src/Buyer/helper/dbHelper', () => ({
      checkObjectId: jest.fn(),
      formatMongoData: jest.fn().mockReturnValue({}),
      getProductsBySeller: jest.fn().mockResolvedValue([]),
    }));

    jest.doMock('../src/utils/emailService', () => ({
      orderPlaced: jest.fn().mockResolvedValue(undefined),
      lowStockAlert: jest.fn().mockResolvedValue(undefined),
    }));

    jest.doMock('../src/Buyer/Service/adminControlledFxService', () => ({
      getFxRateNGNtoUSD: jest.fn().mockResolvedValue(0.00065),
    }));

    jest.doMock('../src/Buyer/constants', () => ({
      buyerOrderMessage: { CART_NOT_FOUND: 'Cart not found', EMPTY_CART: 'Empty cart' },
    }));

    jest.doMock('../src/Buyer/models/buyerNotificationModel', () => jest.fn());
    jest.doMock('../src/models/sellerNotificationModel', () => jest.fn());
    jest.doMock('../src/utils/notificationService', () =>
      jest.fn().mockReturnValue({ create: notifCreate })
    );
    jest.doMock('moment', () => jest.fn(() => ({ format: jest.fn().mockReturnValue('2024-01-01') })));

    const svc = require('../src/Buyer/Service/buyerOrderService');
    return { svc, notifCreate, SELLER_A, SELLER_B };
  }

  const baseServiceData = () => ({
    cartId: 'cart-1',
    userId: BUYER_OID,
    paymentMethod: 'pod',
    deliveryAddresses: {
      address: '1 Main St',
      postalCode: '100001',
      cityName: 'Lagos',
      countryCode: 'NG',
      countryName: 'Nigeria',
    },
  });

  it('fires an order_placed notification to the buyer', async () => {
    const { svc, notifCreate } = buildOrderMocks();
    await svc.createOrder(baseServiceData());
    await new Promise((r) => setImmediate(r));

    expect(notifCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order_placed', ownerId: BUYER_OID })
    );
  });

  it('fires a new_order notification for each unique seller', async () => {
    const { svc, notifCreate, SELLER_A, SELLER_B } = buildOrderMocks();
    await svc.createOrder(baseServiceData());
    await new Promise((r) => setImmediate(r));

    const sellerCalls = notifCreate.mock.calls.filter(
      ([args]) => args.type === 'new_order'
    );
    const notifiedSellers = sellerCalls.map(([args]) => args.ownerId.toString());

    expect(notifiedSellers).toContain(SELLER_A);
    expect(notifiedSellers).toContain(SELLER_B);
  });

  it('sends exactly one notification per unique seller (deduplication)', async () => {
    const { svc, notifCreate } = buildOrderMocks();
    await svc.createOrder(baseServiceData());
    await new Promise((r) => setImmediate(r));

    const sellerCalls = notifCreate.mock.calls.filter(
      ([args]) => args.type === 'new_order'
    );
    // 2 unique sellers → 2 new_order notifications
    expect(sellerCalls).toHaveLength(2);
  });

  it('total notification calls: 1 buyer + N sellers', async () => {
    const { svc, notifCreate } = buildOrderMocks();
    await svc.createOrder(baseServiceData());
    await new Promise((r) => setImmediate(r));

    // 1 order_placed (buyer) + 2 new_order (sellers)
    expect(notifCreate).toHaveBeenCalledTimes(3);
  });

  it('order creation succeeds even when notifications throw', async () => {
    const failCreate = jest.fn().mockRejectedValue(new Error('notification DB down'));
    const { svc } = buildOrderMocks({ notifCreate: failCreate });

    const result = await svc.createOrder(baseServiceData());
    await new Promise((r) => setImmediate(r));

    expect(result).toHaveProperty('orderId');
  });
});
