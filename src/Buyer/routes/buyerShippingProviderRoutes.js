const express = require('express');
const router = express.Router();
const shippingWebhookController = require('../controllers/shippingWebhookController');

router.post('/webhooks/haulam', shippingWebhookController.handleHaulamWebhook);

module.exports = router;
