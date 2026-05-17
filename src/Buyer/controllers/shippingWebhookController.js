const Order = require('../models/buyerOrderModel');
const buyerHaulamService = require('../Service/buyerHaulamService');
const shippingProviderService = require('../Service/shippingProviderService');
const constants = require('../constants');
const BuyerNotification = require('../models/buyerNotificationModel');
const createNotificationService = require('../../utils/notificationService');
const buyerNotifSvc = createNotificationService(BuyerNotification, 'buyerId');

const WEBHOOK_STATUS_NOTIFICATION = {
  completed: { type: 'order_delivered', title: 'Order Delivered',  message: 'Your order has been delivered. Thank you for shopping with us!' },
  canceled:  { type: 'order_cancelled', title: 'Order Cancelled',  message: 'Your shipment was cancelled. Please contact support if you need help.' },
};

module.exports.handleHaulamWebhook = async (req, res) => {
  try {
    if (!shippingProviderService.isHaulamProviderActive()) {
      return res.status(200).json({
        ...constants.customServerResponse,
        status: 200,
        message: 'Haulam webhook ignored because DEFAULT_PROVIDER is not HAULAM',
        body: { ignored: true }
      });
    }

    const webhookPayload = buyerHaulamService.parseWebhookPayload(req.body);
    if (!webhookPayload.shipmentId) {
      return res.status(400).json({
        ...constants.customServerResponse,
        status: 400,
        message: 'Invalid Haulam webhook payload: shipment id is required',
        body: {}
      });
    }

    const update = {
      shipmentStatus: webhookPayload.shipmentStatus || 'Updated',
      shipmentPaymentStatus: webhookPayload.shipmentPaymentStatus || null,
      shipmentLastUpdatedAt: new Date(),
    };

    const normalizedStatus = (webhookPayload.shipmentStatus || '').toLowerCase();
    if (['delivered', 'completed'].includes(normalizedStatus)) {
      update.orderStatus = 'completed';
    } else if (['cancelled', 'canceled'].includes(normalizedStatus)) {
      update.orderStatus = 'canceled';
    }

    const shipmentFilter = {
      $or: [
        { shipmentId: webhookPayload.shipmentId },
        { shipmentReference: webhookPayload.shipmentId }
      ]
    };

    // Fetch affected orders before updating so we have buyer IDs for notifications
    const affectedOrders = update.orderStatus
      ? await Order.find(shipmentFilter).select('userId orderStatus').lean()
      : [];

    const updateResult = await Order.updateMany(shipmentFilter, { $set: update });

    // Fire buyer notifications for status-changing events
    if (update.orderStatus && affectedOrders.length > 0) {
      const notif = WEBHOOK_STATUS_NOTIFICATION[update.orderStatus];
      if (notif) {
        setImmediate(async () => {
          const jobs = affectedOrders
            .filter(o => o.userId)
            .map(o => buyerNotifSvc.create({
              ownerId: o.userId,
              type: notif.type,
              title: notif.title,
              message: notif.message,
              metadata: { shipmentId: webhookPayload.shipmentId },
            }));
          await Promise.allSettled(jobs);
        });
      }
    }

    const matchedCount = updateResult.matchedCount ?? updateResult.n ?? 0;
    const modifiedCount = updateResult.modifiedCount ?? updateResult.nModified ?? 0;

    return res.status(200).json({
      ...constants.customServerResponse,
      status: 200,
      message: 'Haulam webhook processed successfully',
      body: {
        event: webhookPayload.event,
        shipmentId: webhookPayload.shipmentId,
        matchedCount,
        modifiedCount,
      }
    });
  } catch (error) {
    console.error('Haulam webhook processing error:', error.message);
    return res.status(500).json({
      ...constants.customServerResponse,
      status: 500,
      message: error.message || 'Failed to process Haulam webhook',
      body: {}
    });
  }
};
