const BuyerNotification = require('../models/buyerNotificationModel');
const createNotificationService = require('../../utils/notificationService');

const svc = createNotificationService(BuyerNotification, 'buyerId');

module.exports.getNotifications = async (req, res) => {
  try {
    const { skip = 0, limit = 20 } = req.query;
    const data = await svc.getAll({ ownerId: req.user.id, skip, limit });
    return res.status(200).json({ status: 200, success: true, body: data });
  } catch (e) {
    return res.status(500).json({ status: 500, success: false, message: e.message });
  }
};

module.exports.markRead = async (req, res) => {
  try {
    const updated = await svc.markRead({ ownerId: req.user.id, notificationId: req.params.id });
    return res.status(200).json({ status: 200, success: true, body: updated });
  } catch (e) {
    return res.status(e.message === 'Notification not found' ? 404 : 500).json({ status: 500, success: false, message: e.message });
  }
};

module.exports.markAllRead = async (req, res) => {
  try {
    await svc.markAllRead({ ownerId: req.user.id });
    return res.status(200).json({ status: 200, success: true, message: 'All notifications marked as read' });
  } catch (e) {
    return res.status(500).json({ status: 500, success: false, message: e.message });
  }
};

module.exports.deleteNotification = async (req, res) => {
  try {
    await svc.deleteOne({ ownerId: req.user.id, notificationId: req.params.id });
    return res.status(200).json({ status: 200, success: true, message: 'Notification deleted' });
  } catch (e) {
    return res.status(e.message === 'Notification not found' ? 404 : 500).json({ status: 500, success: false, message: e.message });
  }
};
