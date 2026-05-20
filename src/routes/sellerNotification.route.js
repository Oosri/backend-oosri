const express = require('express');
const { sellerAuth } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/sellerNotificationController');

const router = express.Router();

router.use(sellerAuth);

router.get('/', ctrl.getNotifications);
router.patch('/:id/read', ctrl.markRead);
router.patch('/read-all', ctrl.markAllRead);
router.delete('/:id', ctrl.deleteNotification);

module.exports = router;
