const Admin = require('../Model/adminAuthModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');

module.exports = {
  listAdmins: async () => {
    const admins = await Admin.find().sort({ createdAt: -1 });
    return admins.map((a) => mongoDbDataFormat.formatMongoData(a));
  },

  getAdminById: async (adminId) => {
    mongoDbDataFormat.checkObjectId(adminId);
    const admin = await Admin.findById(adminId);
    if (!admin) throw new Error(constants.adminManagementMessage.ADMIN_NOT_FOUND);
    return mongoDbDataFormat.formatMongoData(admin);
  },

  updateAdmin: async ({ adminId, requesterId, updates }) => {
    mongoDbDataFormat.checkObjectId(adminId);

    const target = await Admin.findById(adminId);
    if (!target) throw new Error(constants.adminManagementMessage.ADMIN_NOT_FOUND);

    // Prevent modifying another super_admin (except self-profile edits handled elsewhere)
    if (target.userRoles === 'super_admin' && target._id.toString() !== requesterId) {
      throw new Error(constants.adminManagementMessage.CANNOT_DEMOTE_SUPER);
    }

    const allowed = ['fullName', 'phoneNumber', 'userRoles', 'permissions'];
    const safeUpdates = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key];
    }

    const updated = await Admin.findByIdAndUpdate(
      adminId,
      { $set: safeUpdates },
      { new: true, runValidators: true }
    );

    return mongoDbDataFormat.formatMongoData(updated);
  },

  deleteAdmin: async ({ adminId, requesterId }) => {
    mongoDbDataFormat.checkObjectId(adminId);

    if (adminId === requesterId) {
      throw new Error(constants.adminManagementMessage.CANNOT_DELETE_SELF);
    }

    const target = await Admin.findById(adminId);
    if (!target) throw new Error(constants.adminManagementMessage.ADMIN_NOT_FOUND);

    if (target.userRoles === 'super_admin') {
      throw new Error(constants.adminManagementMessage.CANNOT_DEMOTE_SUPER);
    }

    await Admin.findByIdAndDelete(adminId);
  },
};
