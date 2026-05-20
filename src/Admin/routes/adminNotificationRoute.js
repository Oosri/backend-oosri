const express = require('express');
const router = express.Router();
const adminNotificationController = require('../controllers/adminNotificationController');
const accessControlValidation = require('../middleware/accessControlValidation');

router.use(accessControlValidation.validateToken, accessControlValidation.isAdmin);

router.get('/', adminNotificationController.getNotifications);
router.patch('/read-all', adminNotificationController.markAllAsRead);
router.patch('/:id/read', adminNotificationController.markAsRead);
router.delete('/:id', adminNotificationController.deleteNotification);

module.exports = router;
