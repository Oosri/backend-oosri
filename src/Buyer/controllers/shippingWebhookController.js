const Order = require('../models/buyerOrderModel');
const buyerHaulamService = require('../Service/buyerHaulamService');
const shippingProviderService = require('../Service/shippingProviderService');
const constants = require('../constants');

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

    const updateResult = await Order.updateMany(
      {
        $or: [
          { shipmentId: webhookPayload.shipmentId },
          { shipmentReference: webhookPayload.shipmentId }
        ]
      },
      { $set: update }
    );

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
