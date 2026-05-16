const AdminNotification = require('../Model/adminNotificationModel');

module.exports = {
  createNotification: async ({ type, title, message, metadata = {} }) => {
    const notification = new AdminNotification({ type, title, message, metadata });
    await notification.save();
    return notification.toObject();
  },

  getNotifications: async ({ skip = 0, limit = 20 } = {}) => {
    const [notifications, total, unreadCount] = await Promise.all([
      AdminNotification.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .then((docs) => docs.map((d) => ({ ...d, id: d._id, _id: undefined, __v: undefined }))),
      AdminNotification.countDocuments(),
      AdminNotification.countDocuments({ isRead: false }),
    ]);
    return { notifications, total, unreadCount };
  },

  markAsRead: async (notificationId) => {
    const updated = await AdminNotification.findByIdAndUpdate(
      notificationId,
      { $set: { isRead: true } },
      { new: true }
    );
    if (!updated) throw new Error('Notification not found');
    return updated.toObject();
  },

  markAllAsRead: async () => {
    await AdminNotification.updateMany({ isRead: false }, { $set: { isRead: true } });
  },

  deleteNotification: async (notificationId) => {
    const deleted = await AdminNotification.findByIdAndDelete(notificationId);
    if (!deleted) throw new Error('Notification not found');
  },
};
