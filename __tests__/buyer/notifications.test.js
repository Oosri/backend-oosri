/**
 * Unit tests — buyer notification controller
 * Tests the HTTP layer (req/res) for get, markRead, markAllRead, delete.
 * The underlying notificationService factory is covered in orderNotifications.test.js.
 */

const { makeNotif, BUYER_OID, VALID_OID } = require('../helpers/factories');

// Mock the notification service factory before requiring the controller
const mockSvc = {
  getAll:      jest.fn(),
  markRead:    jest.fn(),
  markAllRead: jest.fn(),
  deleteOne:   jest.fn(),
};

jest.mock('../../src/Buyer/models/buyerNotificationModel');
jest.mock('../../src/utils/notificationService', () => jest.fn().mockReturnValue(mockSvc));

const ctrl = require('../../src/Buyer/controllers/buyerNotificationController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

function req(overrides = {}) {
  return {
    user:   { id: BUYER_OID },
    query:  {},
    params: {},
    body:   {},
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

// ─── getNotifications ─────────────────────────────────────────────────────────

describe('getNotifications', () => {
  it('responds 200 with notification data', async () => {
    const data = { notifications: [makeNotif()], unreadCount: 1, total: 1 };
    mockSvc.getAll.mockResolvedValue(data);

    const res = mockRes();
    await ctrl.getNotifications(req({ query: { skip: '0', limit: '20' } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ body: data }));
    expect(mockSvc.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: BUYER_OID })
    );
  });

  it('responds 500 when service throws', async () => {
    mockSvc.getAll.mockRejectedValue(new Error('DB error'));
    const res = mockRes();
    await ctrl.getNotifications(req(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── markRead ─────────────────────────────────────────────────────────────────

describe('markRead', () => {
  it('responds 200 with updated notification', async () => {
    const notif = makeNotif({ isRead: true });
    mockSvc.markRead.mockResolvedValue(notif);

    const res = mockRes();
    await ctrl.markRead(req({ params: { id: VALID_OID } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockSvc.markRead).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: BUYER_OID, notificationId: VALID_OID })
    );
  });

  it('responds 404 when notification not found', async () => {
    mockSvc.markRead.mockRejectedValue(new Error('Notification not found'));
    const res = mockRes();
    await ctrl.markRead(req({ params: { id: VALID_OID } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('responds 500 on generic error', async () => {
    mockSvc.markRead.mockRejectedValue(new Error('DB error'));
    const res = mockRes();
    await ctrl.markRead(req({ params: { id: VALID_OID } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
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
      expect.objectContaining({ ownerId: BUYER_OID })
    );
  });

  it('responds 500 when service throws', async () => {
    mockSvc.markAllRead.mockRejectedValue(new Error('fail'));
    const res = mockRes();
    await ctrl.markAllRead(req(), res);
    expect(res.status).toHaveBeenCalledWith(500);
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
      expect.objectContaining({ ownerId: BUYER_OID, notificationId: VALID_OID })
    );
  });

  it('responds 404 when notification not found', async () => {
    mockSvc.deleteOne.mockRejectedValue(new Error('Notification not found'));
    const res = mockRes();
    await ctrl.deleteNotification(req({ params: { id: VALID_OID } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
