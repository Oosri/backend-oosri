/**
 * Unit tests for the admin notification feature.
 * All DB calls are mocked — no real MongoDB connection needed.
 */

// ─── adminNotificationService ────────────────────────────────────────────────

describe('adminNotificationService', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function makeDoc(overrides = {}) {
    const base = {
      _id: 'notif-id-1',
      type: 'new_order',
      title: 'New Order Placed',
      message: 'A new order has been placed.',
      isRead: false,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const merged = { ...base, ...overrides };
    return {
      ...merged,
      toObject: () => ({ ...merged, id: merged._id, _id: undefined, __v: undefined }),
    };
  }

  // ── createNotification ─────────────────────────────────────────────────────

  describe('createNotification', () => {
    it('saves a new notification and returns its data', async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined);
      const mockDoc  = { type: 'new_order', title: 'T', message: 'M', metadata: {}, toObject: () => ({}) };

      jest.doMock('../src/Admin/Model/adminNotificationModel', () =>
        jest.fn().mockImplementation(() => ({ ...mockDoc, save: mockSave }))
      );

      const { createNotification } = require('../src/Admin/services/adminNotificationService');
      const result = await createNotification({ type: 'new_order', title: 'T', message: 'M' });

      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });

    it('defaults metadata to {} when not provided', async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined);
      let mockCaptured = null;

      jest.doMock('../src/Admin/Model/adminNotificationModel', () =>
        jest.fn().mockImplementation((data) => {
          mockCaptured = data;
          return { ...data, save: mockSave, toObject: () => data };
        })
      );

      const { createNotification } = require('../src/Admin/services/adminNotificationService');
      await createNotification({ type: 'system', title: 'Hi', message: 'Hello' });

      expect(mockCaptured).toMatchObject({ metadata: {} });
    });

    it('propagates DB save errors', async () => {
      const mockSave = jest.fn().mockRejectedValue(new Error('DB write failed'));

      jest.doMock('../src/Admin/Model/adminNotificationModel', () =>
        jest.fn().mockImplementation(() => ({ save: mockSave }))
      );

      const { createNotification } = require('../src/Admin/services/adminNotificationService');
      await expect(
        createNotification({ type: 'system', title: 'X', message: 'Y' })
      ).rejects.toThrow('DB write failed');
    });
  });

  // ── getNotifications ───────────────────────────────────────────────────────

  describe('getNotifications', () => {
    it('returns notifications, total, and unreadCount', async () => {
      const mockDocs = [
        { _id: 'a', type: 'new_order',  title: 'T1', message: 'M1', isRead: false },
        { _id: 'b', type: 'new_seller', title: 'T2', message: 'M2', isRead: true  },
      ];

      jest.doMock('../src/Admin/Model/adminNotificationModel', () => {
        const M = jest.fn();
        M.find = jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue(mockDocs),
        });
        M.countDocuments = jest.fn()
          .mockResolvedValueOnce(2)  // total
          .mockResolvedValueOnce(1); // unreadCount
        return M;
      });

      const { getNotifications } = require('../src/Admin/services/adminNotificationService');
      const result = await getNotifications({ skip: 0, limit: 20 });

      expect(result.notifications).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.unreadCount).toBe(1);
    });

    it('applies skip and limit to the query chain', async () => {
      const mockSkip  = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();

      jest.doMock('../src/Admin/Model/adminNotificationModel', () => {
        const M = jest.fn();
        M.find = jest.fn().mockReturnValue({
          sort:  jest.fn().mockReturnThis(),
          skip:  mockSkip,
          limit: mockLimit,
          lean:  jest.fn().mockResolvedValue([]),
        });
        M.countDocuments = jest.fn().mockResolvedValue(0);
        return M;
      });

      const { getNotifications } = require('../src/Admin/services/adminNotificationService');
      await getNotifications({ skip: 10, limit: 5 });

      expect(mockSkip).toHaveBeenCalledWith(10);
      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it('maps _id to id and strips __v from each result', async () => {
      const mockDocs = [{ _id: 'abc', type: 'system', title: 'T', message: 'M', __v: 0 }];

      jest.doMock('../src/Admin/Model/adminNotificationModel', () => {
        const M = jest.fn();
        M.find = jest.fn().mockReturnValue({
          sort:  jest.fn().mockReturnThis(),
          skip:  jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          lean:  jest.fn().mockResolvedValue(mockDocs),
        });
        M.countDocuments = jest.fn().mockResolvedValue(1);
        return M;
      });

      const { getNotifications } = require('../src/Admin/services/adminNotificationService');
      const { notifications } = await getNotifications();

      expect(notifications[0].id).toBe('abc');
      expect(notifications[0]._id).toBeUndefined();
      expect(notifications[0].__v).toBeUndefined();
    });
  });

  // ── markAsRead ─────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('calls findByIdAndUpdate with $set { isRead: true }', async () => {
      const mockFindByIdAndUpdate = jest.fn().mockResolvedValue({
        isRead: true,
        toObject: () => ({ isRead: true }),
      });

      jest.doMock('../src/Admin/Model/adminNotificationModel', () => {
        const M = jest.fn();
        M.findByIdAndUpdate = mockFindByIdAndUpdate;
        return M;
      });

      const { markAsRead } = require('../src/Admin/services/adminNotificationService');
      await markAsRead('notif-id-1');

      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        'notif-id-1',
        { $set: { isRead: true } },
        { new: true }
      );
    });

    it('throws "Notification not found" when document does not exist', async () => {
      jest.doMock('../src/Admin/Model/adminNotificationModel', () => {
        const M = jest.fn();
        M.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
        return M;
      });

      const { markAsRead } = require('../src/Admin/services/adminNotificationService');
      await expect(markAsRead('missing-id')).rejects.toThrow('Notification not found');
    });
  });

  // ── markAllAsRead ──────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('calls updateMany targeting only unread documents', async () => {
      const mockUpdateMany = jest.fn().mockResolvedValue({});

      jest.doMock('../src/Admin/Model/adminNotificationModel', () => {
        const M = jest.fn();
        M.updateMany = mockUpdateMany;
        return M;
      });

      const { markAllAsRead } = require('../src/Admin/services/adminNotificationService');
      await markAllAsRead();

      expect(mockUpdateMany).toHaveBeenCalledWith(
        { isRead: false },
        { $set: { isRead: true } }
      );
    });
  });

  // ── deleteNotification ─────────────────────────────────────────────────────

  describe('deleteNotification', () => {
    it('calls findByIdAndDelete with the correct id', async () => {
      const mockFindByIdAndDelete = jest.fn().mockResolvedValue({ _id: 'notif-id-1' });

      jest.doMock('../src/Admin/Model/adminNotificationModel', () => {
        const M = jest.fn();
        M.findByIdAndDelete = mockFindByIdAndDelete;
        return M;
      });

      const { deleteNotification } = require('../src/Admin/services/adminNotificationService');
      await deleteNotification('notif-id-1');

      expect(mockFindByIdAndDelete).toHaveBeenCalledWith('notif-id-1');
    });

    it('throws "Notification not found" when document does not exist', async () => {
      jest.doMock('../src/Admin/Model/adminNotificationModel', () => {
        const M = jest.fn();
        M.findByIdAndDelete = jest.fn().mockResolvedValue(null);
        return M;
      });

      const { deleteNotification } = require('../src/Admin/services/adminNotificationService');
      await expect(deleteNotification('ghost-id')).rejects.toThrow('Notification not found');
    });
  });
});


// ─── Fire-and-forget safety in buyerOrderController ──────────────────────────

describe('buyerOrderController.createOrder — notification is fire-and-forget', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function makeReqRes() {
    const req = { body: { items: [] }, user: { id: 'user-1' } };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    return { req, res };
  }

  it('returns 201 even when notification creation throws', async () => {
    jest.doMock('../src/Buyer/Service/buyerOrderService', () => ({
      createOrder: jest.fn().mockResolvedValue({ id: 'order-1' }),
    }));
    jest.doMock('../src/Admin/services/adminNotificationService', () => ({
      createNotification: jest.fn().mockRejectedValue(new Error('Notification DB down')),
    }));
    jest.doMock('../src/Admin/constants', () => ({
      customServerResponse: { status: 500, message: '', body: null },
      buyerOrderMessage: { ORDER_CREATED: 'Order created' },
    }));

    const { createOrder } = require('../src/Buyer/controllers/buyerOrderController');
    const { req, res } = makeReqRes();

    await createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalled();
  });

  it('returns 201 and calls createNotification when order succeeds', async () => {
    const mockCreateNotification = jest.fn().mockResolvedValue({});

    jest.doMock('../src/Buyer/Service/buyerOrderService', () => ({
      createOrder: jest.fn().mockResolvedValue({ id: 'order-2' }),
    }));
    jest.doMock('../src/Admin/services/adminNotificationService', () => ({
      createNotification: mockCreateNotification,
    }));
    jest.doMock('../src/Admin/constants', () => ({
      customServerResponse: { status: 500, message: '', body: null },
      buyerOrderMessage: { ORDER_CREATED: 'Order created' },
    }));

    const { createOrder } = require('../src/Buyer/controllers/buyerOrderController');
    const { req, res } = makeReqRes();

    await createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    // wait for the fire-and-forget to settle
    await new Promise((r) => setImmediate(r));
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'new_order' })
    );
  });

  it('does not return 201 when the order service itself throws', async () => {
    jest.doMock('../src/Buyer/Service/buyerOrderService', () => ({
      createOrder: jest.fn().mockRejectedValue(new Error('Payment failed')),
    }));
    jest.doMock('../src/Admin/services/adminNotificationService', () => ({
      createNotification: jest.fn(),
    }));
    jest.doMock('../src/Admin/constants', () => ({
      customServerResponse: { status: 400, message: '', body: null },
      buyerOrderMessage: { ORDER_CREATED: 'Order created' },
    }));

    const { createOrder } = require('../src/Buyer/controllers/buyerOrderController');
    const { req, res } = makeReqRes();

    await createOrder(req, res);

    expect(res.status).not.toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalled();
  });
});
