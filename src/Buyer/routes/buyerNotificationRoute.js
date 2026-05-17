const express = require('express');
const { validateToken } = require('../middlewares/accessControlValidation');
const ctrl = require('../controllers/buyerNotificationController');

const router = express.Router();

router.use(validateToken);

router.get('/', ctrl.getNotifications);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);
router.delete('/:id', ctrl.deleteNotification);

module.exports = router;
