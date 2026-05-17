/**
 * Unit tests — sellerNotificationController
 * Covers: getNotifications, markRead, markAllRead, deleteNotification
 */

const { makeNotif, SELLER_OID, VALID_OID } = require('../helpers/factories');

const mockSvc = {
  getAll:      jest.fn(),
  markRead:    jest.fn(),
  markAllRead: jest.fn(),
  deleteOne:   jest.fn(),
};

jest.mock('../../src/models/sellerNotificationModel');
jest.mock('../../src/utils/notificationService', () => jest.fn().mockReturnValue(mockSvc));

const ctrl = require('../../src/controllers/sellerNotificationController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

function req(overrides = {}) {
  return {
    seller: { _id: SELLER_OID },
    query:  {},
    params: {},
    body:   {},
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

// ─── getNotifications ─────────────────────────────────────────────────────────

describe('getNotifications', () => {
  it('responds 200 with notifications list', async () => {
    const data = { notifications: [makeNotif()], unreadCount: 1, total: 1 };
    mockSvc.getAll.mockResolvedValue(data);

    const res = mockRes();
    await ctrl.getNotifications(req({ query: { skip: '0', limit: '20' } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ body: data }));
    expect(mockSvc.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: SELLER_OID })
    );
  });

  it('responds 500 on service error', async () => {
    mockSvc.getAll.mockRejectedValue(new Error('DB error'));
    const res = mockRes();
    await ctrl.getNotifications(req(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── markRead ─────────────────────────────────────────────────────────────────

describe('markRead', () => {
  it('responds 200 with updated notification', async () => {
    mockSvc.markRead.mockResolvedValue(makeNotif({ isRead: true }));
    const res = mockRes();
    await ctrl.markRead(req({ params: { id: VALID_OID } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockSvc.markRead).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: SELLER_OID, notificationId: VALID_OID })
    );
  });

  it('responds 404 when notification not found', async () => {
    mockSvc.markRead.mockRejectedValue(new Error('Notification not found'));
    const res = mockRes();
    await ctrl.markRead(req({ params: { id: VALID_OID } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── markAllRead ──────────────────────────────────────────────────────────────

describe('markAllRead', () => {
  it('responds 200 with success message', async () => {
    mockSvc.markAllRead.mockResolvedValue(undefined);
    const res = mockRes();
    await ctrl.markAllRead(req(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockSvc.markAllRead).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: SELLER_OID })
    );
  });
});

// ─── deleteNotification ───────────────────────────────────────────────────────

describe('deleteNotification', () => {
  it('responds 200 on successful delete', async () => {
    mockSvc.deleteOne.mockResolvedValue(undefined);
    const res = mockRes();
    await ctrl.deleteNotification(req({ params: { id: VALID_OID } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockSvc.deleteOne).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: SELLER_OID, notificationId: VALID_OID })
    );
  });

  it('responds 404 when notification not found', async () => {
    mockSvc.deleteOne.mockRejectedValue(new Error('Notification not found'));
    const res = mockRes();
    await ctrl.deleteNotification(req({ params: { id: VALID_OID } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
