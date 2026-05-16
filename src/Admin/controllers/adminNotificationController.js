const adminNotificationService = require('../services/adminNotificationService');

module.exports.getNotifications = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const result = await adminNotificationService.getNotifications({ skip, limit });
    return res.status(200).json({ status: 200, message: 'Notifications fetched', body: result });
  } catch (error) {
    console.error('Controller: getNotifications', error);
    return res.status(500).json({ status: 500, message: error.message });
  }
};

module.exports.markAsRead = async (req, res) => {
  try {
    const result = await adminNotificationService.markAsRead(req.params.id);
    return res.status(200).json({ status: 200, message: 'Notification marked as read', body: result });
  } catch (error) {
    console.error('Controller: markAsRead', error);
    return res.status(400).json({ status: 400, message: error.message });
  }
};

module.exports.markAllAsRead = async (req, res) => {
  try {
    await adminNotificationService.markAllAsRead();
    return res.status(200).json({ status: 200, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Controller: markAllAsRead', error);
    return res.status(500).json({ status: 500, message: error.message });
  }
};

module.exports.deleteNotification = async (req, res) => {
  try {
    await adminNotificationService.deleteNotification(req.params.id);
    return res.status(200).json({ status: 200, message: 'Notification deleted' });
  } catch (error) {
    console.error('Controller: deleteNotification', error);
    return res.status(400).json({ status: 400, message: error.message });
  }
};
