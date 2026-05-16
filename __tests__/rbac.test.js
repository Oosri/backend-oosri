/**
 * Unit tests for the RBAC feature:
 * - requirePermission middleware
 * - isSuperAdmin middleware
 * - isAdmin middleware (updated to allow super_admin)
 * - adminManagementService (listAdmins, getAdminById, updateAdmin, deleteAdmin)
 */

// ─── Middleware tests ─────────────────────────────────────────────────────────

describe('accessControlValidation middleware', () => {
  beforeEach(() => jest.resetModules());

  function makeRes() {
    return { status: jest.fn().mockReturnThis(), send: jest.fn() };
  }

  // ── isAdmin ──────────────────────────────────────────────────────────────

  describe('isAdmin', () => {
    it('allows through an admin user and attaches adminUser to req', async () => {
      const mockAdmin = { _id: 'id-1', userRoles: 'admin', permissions: [] };
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn().mockResolvedValue(mockAdmin),
        VALID_PERMISSIONS: [],
      }));
      jest.doMock('../src/Admin/constants', () => ({
        customServerResponse: { status: 400 },
        requestValidationMessage: { FORBIDDEN: 'Forbidden', SUPER_ADMIN_ONLY: 'Super admin only' },
      }));

      const { isAdmin } = require('../src/Admin/middleware/accessControlValidation');
      const req = { user: { id: 'id-1' } };
      const res = makeRes();
      const next = jest.fn();

      await isAdmin(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.adminUser).toBe(mockAdmin);
    });

    it('allows through a super_admin user', async () => {
      const mockAdmin = { _id: 'id-1', userRoles: 'super_admin', permissions: [] };
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn().mockResolvedValue(mockAdmin),
        VALID_PERMISSIONS: [],
      }));
      jest.doMock('../src/Admin/constants', () => ({
        customServerResponse: { status: 400 },
        requestValidationMessage: { FORBIDDEN: 'Forbidden', SUPER_ADMIN_ONLY: 'Super admin only' },
      }));

      const { isAdmin } = require('../src/Admin/middleware/accessControlValidation');
      const req = { user: { id: 'id-1' } };
      const next = jest.fn();

      await isAdmin(req, makeRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('blocks a user with unknown role and returns 403', async () => {
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn().mockResolvedValue({ userRoles: 'guest' }),
        VALID_PERMISSIONS: [],
      }));
      jest.doMock('../src/Admin/constants', () => ({
        customServerResponse: { status: 400 },
        requestValidationMessage: { FORBIDDEN: 'Forbidden', SUPER_ADMIN_ONLY: 'Super admin only' },
      }));

      const { isAdmin } = require('../src/Admin/middleware/accessControlValidation');
      const req = { user: { id: 'id-1' } };
      const res = makeRes();
      const next = jest.fn();

      await isAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // ── isSuperAdmin ──────────────────────────────────────────────────────────

  describe('isSuperAdmin', () => {
    it('allows super_admin through', async () => {
      const mockAdmin = { _id: 'id-1', userRoles: 'super_admin' };
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn().mockResolvedValue(mockAdmin),
        VALID_PERMISSIONS: [],
      }));
      jest.doMock('../src/Admin/constants', () => ({
        customServerResponse: { status: 400 },
        requestValidationMessage: { FORBIDDEN: 'Forbidden', SUPER_ADMIN_ONLY: 'Super admin only' },
      }));

      const { isSuperAdmin } = require('../src/Admin/middleware/accessControlValidation');
      const req = { adminUser: mockAdmin };
      const next = jest.fn();

      await isSuperAdmin(req, makeRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('blocks a regular admin with 403', async () => {
      const mockAdmin = { _id: 'id-1', userRoles: 'admin' };
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn().mockResolvedValue(mockAdmin),
        VALID_PERMISSIONS: [],
      }));
      jest.doMock('../src/Admin/constants', () => ({
        customServerResponse: { status: 400 },
        requestValidationMessage: { FORBIDDEN: 'Forbidden', SUPER_ADMIN_ONLY: 'Super admin only' },
      }));

      const { isSuperAdmin } = require('../src/Admin/middleware/accessControlValidation');
      const req = { adminUser: mockAdmin };
      const res = makeRes();
      const next = jest.fn();

      await isSuperAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // ── requirePermission ─────────────────────────────────────────────────────

  describe('requirePermission', () => {
    function mockDeps(adminUser) {
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn().mockResolvedValue(adminUser),
        VALID_PERMISSIONS: [],
      }));
      jest.doMock('../src/Admin/constants', () => ({
        customServerResponse: { status: 400 },
        requestValidationMessage: { FORBIDDEN: 'Forbidden', SUPER_ADMIN_ONLY: 'Super admin only' },
      }));
    }

    it('super_admin bypasses all permission checks', async () => {
      const adminUser = { userRoles: 'super_admin', permissions: [] };
      mockDeps(adminUser);

      const { requirePermission } = require('../src/Admin/middleware/accessControlValidation');
      const req = { adminUser };
      const next = jest.fn();

      await requirePermission('orders')(req, makeRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('allows admin who has the required permission', async () => {
      const adminUser = { userRoles: 'admin', permissions: ['orders', 'products'] };
      mockDeps(adminUser);

      const { requirePermission } = require('../src/Admin/middleware/accessControlValidation');
      const req = { adminUser };
      const next = jest.fn();

      await requirePermission('orders')(req, makeRes(), next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('blocks admin who lacks the required permission', async () => {
      const adminUser = { userRoles: 'admin', permissions: ['products'] };
      mockDeps(adminUser);

      const { requirePermission } = require('../src/Admin/middleware/accessControlValidation');
      const req = { adminUser };
      const res = makeRes();
      const next = jest.fn();

      await requirePermission('orders')(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('blocks admin with empty permissions array', async () => {
      const adminUser = { userRoles: 'admin', permissions: [] };
      mockDeps(adminUser);

      const { requirePermission } = require('../src/Admin/middleware/accessControlValidation');
      const req = { adminUser };
      const res = makeRes();
      const next = jest.fn();

      await requirePermission('sellers')(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('uses req.adminUser when present (no extra DB call)', async () => {
      const findById = jest.fn();
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById,
        VALID_PERMISSIONS: [],
      }));
      jest.doMock('../src/Admin/constants', () => ({
        customServerResponse: { status: 400 },
        requestValidationMessage: { FORBIDDEN: 'Forbidden', SUPER_ADMIN_ONLY: 'Super admin only' },
      }));

      const { requirePermission } = require('../src/Admin/middleware/accessControlValidation');
      const req = { adminUser: { userRoles: 'super_admin', permissions: [] } };
      const next = jest.fn();

      await requirePermission('orders')(req, makeRes(), next);

      expect(findById).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});


// ─── adminManagementService tests ────────────────────────────────────────────

describe('adminManagementService', () => {
  beforeEach(() => jest.resetModules());

  const REQUESTER_ID = 'requester-id-1';

  function mockCheckObjectId(shouldThrow = false) {
    jest.doMock('../src/Admin/helper/dbHelper', () => ({
      checkObjectId: shouldThrow
        ? jest.fn(() => { throw new Error('Invalid Id'); })
        : jest.fn(),
      formatMongoData: jest.fn((doc) => ({ ...doc.toObject() })),
    }));
  }

  function makeAdmin(overrides = {}) {
    const base = {
      _id: { toString: () => 'admin-id-1' },
      email: 'test@oosri.com',
      fullName: 'Test Admin',
      userRoles: 'admin',
      permissions: ['orders'],
    };
    const merged = { ...base, ...overrides };
    return { ...merged, toObject: () => merged };
  }

  function mockConstants() {
    jest.doMock('../src/Admin/constants', () => ({
      adminManagementMessage: {
        ADMIN_NOT_FOUND: 'Admin not found',
        CANNOT_DELETE_SELF: 'You cannot delete your own account',
        CANNOT_DEMOTE_SUPER: 'Cannot modify another super admin',
      },
    }));
  }

  // ── listAdmins ────────────────────────────────────────────────────────────

  describe('listAdmins', () => {
    it('returns all admins sorted by createdAt desc', async () => {
      const admins = [makeAdmin(), makeAdmin({ _id: { toString: () => 'admin-id-2' } })];
      mockCheckObjectId();
      mockConstants();
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        find: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue(admins) }),
      }));

      const { listAdmins } = require('../src/Admin/services/adminManagementService');
      const result = await listAdmins();

      expect(result).toHaveLength(2);
    });
  });

  // ── getAdminById ──────────────────────────────────────────────────────────

  describe('getAdminById', () => {
    it('returns admin when found', async () => {
      const admin = makeAdmin();
      mockCheckObjectId();
      mockConstants();
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn().mockResolvedValue(admin),
      }));

      const { getAdminById } = require('../src/Admin/services/adminManagementService');
      const result = await getAdminById('admin-id-1');

      expect(result).toBeDefined();
    });

    it('throws when admin is not found', async () => {
      mockCheckObjectId();
      mockConstants();
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn().mockResolvedValue(null),
      }));

      const { getAdminById } = require('../src/Admin/services/adminManagementService');
      await expect(getAdminById('missing-id')).rejects.toThrow('Admin not found');
    });
  });

  // ── updateAdmin ───────────────────────────────────────────────────────────

  describe('updateAdmin', () => {
    it('updates allowed fields and returns the updated admin', async () => {
      const target = makeAdmin();
      const updated = makeAdmin({ fullName: 'Updated Name' });
      const mockFindByIdAndUpdate = jest.fn().mockResolvedValue(updated);

      mockCheckObjectId();
      mockConstants();
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn().mockResolvedValue(target),
        findByIdAndUpdate: mockFindByIdAndUpdate,
      }));

      const { updateAdmin } = require('../src/Admin/services/adminManagementService');
      await updateAdmin({
        adminId: 'admin-id-1',
        requesterId: REQUESTER_ID,
        updates: { fullName: 'Updated Name', password: 'should-be-ignored' },
      });

      const [, updateArg] = mockFindByIdAndUpdate.mock.calls[0];
      expect(updateArg.$set.fullName).toBe('Updated Name');
      expect(updateArg.$set.password).toBeUndefined();
    });

    it('throws when trying to modify another super_admin', async () => {
      const target = makeAdmin({ userRoles: 'super_admin' });

      mockCheckObjectId();
      mockConstants();
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn().mockResolvedValue(target),
        findByIdAndUpdate: jest.fn(),
      }));

      const { updateAdmin } = require('../src/Admin/services/adminManagementService');
      await expect(
        updateAdmin({ adminId: 'admin-id-1', requesterId: 'other-id', updates: { userRoles: 'admin' } })
      ).rejects.toThrow('Cannot modify another super admin');
    });

    it('allows a super_admin to update their own record', async () => {
      const SELF_ID = 'super-id-1';
      const target = makeAdmin({ _id: { toString: () => SELF_ID }, userRoles: 'super_admin' });
      const updated = makeAdmin({ _id: { toString: () => SELF_ID }, fullName: 'Updated' });

      mockCheckObjectId();
      mockConstants();
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn().mockResolvedValue(target),
        findByIdAndUpdate: jest.fn().mockResolvedValue(updated),
      }));

      const { updateAdmin } = require('../src/Admin/services/adminManagementService');
      await expect(
        updateAdmin({ adminId: SELF_ID, requesterId: SELF_ID, updates: { fullName: 'Updated' } })
      ).resolves.toBeDefined();
    });
  });

  // ── deleteAdmin ───────────────────────────────────────────────────────────

  describe('deleteAdmin', () => {
    it('deletes a regular admin', async () => {
      const mockDelete = jest.fn().mockResolvedValue({});
      const target = makeAdmin();

      mockCheckObjectId();
      mockConstants();
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn().mockResolvedValue(target),
        findByIdAndDelete: mockDelete,
      }));

      const { deleteAdmin } = require('../src/Admin/services/adminManagementService');
      await deleteAdmin({ adminId: 'admin-id-1', requesterId: REQUESTER_ID });

      expect(mockDelete).toHaveBeenCalledWith('admin-id-1');
    });

    it('throws when trying to delete self', async () => {
      mockCheckObjectId();
      mockConstants();
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn(),
        findByIdAndDelete: jest.fn(),
      }));

      const { deleteAdmin } = require('../src/Admin/services/adminManagementService');
      await expect(
        deleteAdmin({ adminId: REQUESTER_ID, requesterId: REQUESTER_ID })
      ).rejects.toThrow('You cannot delete your own account');
    });

    it('throws when trying to delete a super_admin', async () => {
      const target = makeAdmin({ userRoles: 'super_admin' });

      mockCheckObjectId();
      mockConstants();
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn().mockResolvedValue(target),
        findByIdAndDelete: jest.fn(),
      }));

      const { deleteAdmin } = require('../src/Admin/services/adminManagementService');
      await expect(
        deleteAdmin({ adminId: 'admin-id-1', requesterId: 'other-id' })
      ).rejects.toThrow('Cannot modify another super admin');
    });

    it('throws when admin is not found', async () => {
      mockCheckObjectId();
      mockConstants();
      jest.doMock('../src/Admin/Model/adminAuthModel', () => ({
        findById: jest.fn().mockResolvedValue(null),
        findByIdAndDelete: jest.fn(),
      }));

      const { deleteAdmin } = require('../src/Admin/services/adminManagementService');
      await expect(
        deleteAdmin({ adminId: 'ghost-id', requesterId: REQUESTER_ID })
      ).rejects.toThrow('Admin not found');
    });
  });
});
