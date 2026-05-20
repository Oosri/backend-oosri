const mongoose = require('mongoose');

const createNotificationService = (Model, ownerField) => ({
  create: async ({ ownerId, type, title, message, metadata = {} }) => {
    const doc = new Model({ [ownerField]: ownerId, type, title, message, metadata });
    await doc.save();
    return doc.toObject();
  },

  getAll: async ({ ownerId, skip = 0, limit = 20 }) => {
    const [notifications, total, unreadCount] = await Promise.all([
      Model.find({ [ownerField]: ownerId })
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .lean()
        .then(docs => docs.map(d => ({ ...d, id: d._id, _id: undefined, __v: undefined }))),
      Model.countDocuments({ [ownerField]: ownerId }),
      Model.countDocuments({ [ownerField]: ownerId, isRead: false }),
    ]);
    return { notifications, total, unreadCount };
  },

  markRead: async ({ ownerId, notificationId }) => {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) throw new Error('Invalid notification id');
    const updated = await Model.findOneAndUpdate(
      { _id: notificationId, [ownerField]: ownerId },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!updated) throw new Error('Notification not found');
    return updated.toObject();
  },

  markAllRead: async ({ ownerId }) => {
    await Model.updateMany({ [ownerField]: ownerId, isRead: false }, { $set: { isRead: true } });
  },

  deleteOne: async ({ ownerId, notificationId }) => {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) throw new Error('Invalid notification id');
    const deleted = await Model.findOneAndDelete({ _id: notificationId, [ownerField]: ownerId });
    if (!deleted) throw new Error('Notification not found');
  },
});

module.exports = createNotificationService;
