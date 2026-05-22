const ReturnRequest = require('../Model/returnRequestModel');
const ReturnSettings = require('../Model/returnSettingsModel');
const Order = require('../../Buyer/models/buyerOrderModel');
const Payment = require('../../Buyer/models/paymentModel');
const refundService = require('../../utils/refundService');
const adminNotificationService = require('./adminNotificationService');
const constants = require('../constants');
const mongoose = require('mongoose');
const BuyerNotification = require('../../Buyer/models/buyerNotificationModel');
const createNotificationService = require('../../utils/notificationService');
const { addEmailJob } = require('../../queues/email.queue');

const buyerNotificationSvc = createNotificationService(BuyerNotification, 'buyerId');

const getSettings = async () => {
  let s = await ReturnSettings.findOne({ _singleton: 'global' });
  if (!s) s = await ReturnSettings.create({ _singleton: 'global' });
  return s;
};

const addTimeline = (request, status, note, actorType, actorId, actorName) => {
  request.timeline.push({ status, note, actorType, actorId, actorName, timestamp: new Date() });
};

module.exports = {
  createReturnRequest: async ({ orderId, buyerId, reason, reasonDetail, evidenceUrls = [] }) => {
    try {
      const settings = await getSettings();

      if (!settings.enabled) {
        throw new Error(constants.returnMessage.FEATURE_DISABLED);
      }

      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        throw new Error(constants.databaseMessage.INVALID_ID);
      }

      const order = await Order.findOne({ _id: orderId, userId: buyerId });
      if (!order) throw new Error(constants.returnMessage.ORDER_NOT_ELIGIBLE);

      if (!['completed', 'processing', 'pending_logistics'].includes(order.orderStatus)) {
        throw new Error(constants.returnMessage.ORDER_NOT_ELIGIBLE);
      }

      // Enforce return window
      const referenceDate = order.deliveryDate || order.orderDate;
      const windowMs = settings.windowDays * 24 * 60 * 60 * 1000;
      if (Date.now() - new Date(referenceDate).getTime() > windowMs) {
        throw new Error(constants.returnMessage.WINDOW_EXPIRED);
      }

      const existing = await ReturnRequest.findOne({ orderId, buyerId });
      if (existing) throw new Error(constants.returnMessage.ALREADY_REQUESTED);

      const payment = await Payment.findOne({ order_id: orderId });

      const sellerId = order.sellerId || order.products[0]?.sellerId;

      const returnRequest = new ReturnRequest({
        orderId,
        buyerId,
        sellerId,
        paymentId: payment?._id,
        reason,
        reasonDetail,
        evidenceUrls,
        status: 'pending',
      });

      addTimeline(returnRequest, 'pending', 'Return request submitted by buyer', 'buyer', buyerId, null);

      if (settings.autoApprove) {
        returnRequest.status = 'admin_approved';
        returnRequest.refundType = settings.refundType === 'full' ? 'full' : 'full';
        returnRequest.refundAmountCents = payment?.gross_amount_cents || 0;
        addTimeline(returnRequest, 'admin_approved', 'Auto-approved per platform policy', 'system', null, 'System');
      }

      await returnRequest.save();

      setImmediate(() => {
        adminNotificationService.createNotification({
          type: 'return_request',
          title: 'New Return Request',
          message: `A buyer has submitted a return request for order ${orderId}.`,
          metadata: { orderId: String(orderId), returnRequestId: String(returnRequest._id) },
        }).catch(err => console.error('[ReturnService] Notification failed:', err.message));
      });

      return returnRequest.toObject();
    } catch (error) {
      console.error('Something went wrong: Service: returnRequest.create', error);
      throw new Error(error.message);
    }
  },

  getBuyerReturns: async ({ buyerId, skip = 0, limit = 10 }) => {
    try {
      const [requests, total] = await Promise.all([
        ReturnRequest.find({ buyerId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('orderId', 'orderStatus totalAmount orderDate products')
          .lean(),
        ReturnRequest.countDocuments({ buyerId }),
      ]);
      return {
        returns: requests.map(r => ({ ...r, id: r._id })),
        total,
        currentPage: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Something went wrong: Service: returnRequest.getBuyerReturns', error);
      throw new Error(error.message);
    }
  },

  getBuyerReturnById: async ({ requestId, buyerId }) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(requestId)) throw new Error(constants.databaseMessage.INVALID_ID);
      const request = await ReturnRequest.findOne({ _id: requestId, buyerId })
        .populate('orderId', 'orderStatus totalAmount orderDate products')
        .lean();
      if (!request) throw new Error(constants.returnMessage.REQUEST_NOT_FOUND);
      return { ...request, id: request._id };
    } catch (error) {
      console.error('Something went wrong: Service: returnRequest.getBuyerReturnById', error);
      throw new Error(error.message);
    }
  },

  // Admin: list all return requests with filters
  getAllReturns: async ({ skip = 0, limit = 10, status, search } = {}) => {
    try {
      const query = {};
      if (status) query.status = status;

      const [requests, total] = await Promise.all([
        ReturnRequest.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('buyerId', 'fullName email')
          .populate('orderId', 'orderStatus totalAmount orderDate')
          .populate('sellerId', 'firstName lastName')
          .lean(),
        ReturnRequest.countDocuments(query),
      ]);

      let filtered = requests;
      if (search) {
        const term = search.toLowerCase();
        filtered = requests.filter(r => {
          const buyerName = r.buyerId?.fullName?.toLowerCase() || '';
          const buyerEmail = r.buyerId?.email?.toLowerCase() || '';
          const orderId = String(r.orderId?._id || r.orderId || '');
          return buyerName.includes(term) || buyerEmail.includes(term) || orderId.includes(term);
        });
      }

      return {
        returns: filtered.map(r => ({ ...r, id: r._id })),
        total,
        currentPage: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Something went wrong: Service: returnRequest.getAllReturns', error);
      throw new Error(error.message);
    }
  },

  getReturnById: async (requestId) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(requestId)) throw new Error(constants.databaseMessage.INVALID_ID);
      const request = await ReturnRequest.findById(requestId)
        .populate('buyerId', 'fullName email phoneNumber')
        .populate('orderId', 'orderStatus totalAmount orderDate products deliveryDate paymentMethod')
        .populate('sellerId', 'firstName lastName email')
        .populate('paymentId', 'gateway gross_amount_cents seller_amount_cents status stripe_payment_intent_id paystack_reference')
        .lean();
      if (!request) throw new Error(constants.returnMessage.REQUEST_NOT_FOUND);
      return { ...request, id: request._id };
    } catch (error) {
      console.error('Something went wrong: Service: returnRequest.getReturnById', error);
      throw new Error(error.message);
    }
  },

  approveReturn: async ({ requestId, adminId, adminName, note, refundType, refundAmountCents }) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(requestId)) throw new Error(constants.databaseMessage.INVALID_ID);
      const request = await ReturnRequest.findById(requestId);
      if (!request) throw new Error(constants.returnMessage.REQUEST_NOT_FOUND);

      const allowedFromStatuses = ['pending', 'seller_approved', 'escalated'];
      if (!allowedFromStatuses.includes(request.status)) {
        throw new Error(constants.returnMessage.INVALID_TRANSITION);
      }

      const settings = await getSettings();
      const payment = request.paymentId
        ? await Payment.findById(request.paymentId)
        : await Payment.findOne({ order_id: request.orderId });

      const resolvedRefundType = refundType || (settings.refundType === 'admin_decides' ? 'full' : settings.refundType);
      let resolvedAmountCents;

      if (resolvedRefundType === 'full') {
        resolvedAmountCents = payment?.gross_amount_cents || 0;
      } else {
        const maxPct = settings.maxRefundPercent / 100;
        const max = Math.floor((payment?.gross_amount_cents || 0) * maxPct);
        resolvedAmountCents = Math.min(refundAmountCents || max, max);
      }

      request.status = 'admin_approved';
      request.refundType = resolvedRefundType;
      request.refundAmountCents = resolvedAmountCents;
      request.adminNote = note;
      addTimeline(request, 'admin_approved', note || 'Approved by admin', 'admin', adminId, adminName);

      await request.save();

      setImmediate(async () => {
        try {
          const msg = 'Your return request has been approved. Your refund will be processed shortly.';
          await buyerNotificationSvc.create({
            ownerId: request.buyerId,
            type: 'return_update',
            title: 'Return Request Approved',
            message: msg,
            metadata: { returnRequestId: String(requestId), orderId: String(request.orderId) },
          });
          await addEmailJob('buyer-return-update', {
            buyerId: String(request.buyerId),
            orderId: String(request.orderId),
            returnStatus: 'admin_approved',
            statusMessage: msg,
          });
        } catch (err) {
          console.error('[ReturnService] Buyer notification failed (approveReturn):', err.message);
        }
      });

      return request.toObject();
    } catch (error) {
      console.error('Something went wrong: Service: returnRequest.approveReturn', error);
      throw new Error(error.message);
    }
  },

  rejectReturn: async ({ requestId, adminId, adminName, note }) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(requestId)) throw new Error(constants.databaseMessage.INVALID_ID);
      const request = await ReturnRequest.findById(requestId);
      if (!request) throw new Error(constants.returnMessage.REQUEST_NOT_FOUND);

      const allowedFromStatuses = ['pending', 'seller_approved', 'seller_rejected', 'escalated'];
      if (!allowedFromStatuses.includes(request.status)) {
        throw new Error(constants.returnMessage.INVALID_TRANSITION);
      }

      request.status = 'admin_rejected';
      request.adminNote = note;
      request.resolvedAt = new Date();
      addTimeline(request, 'admin_rejected', note || 'Rejected by admin', 'admin', adminId, adminName);

      await request.save();

      setImmediate(async () => {
        try {
          const msg = note || 'Your return request has been reviewed and was not approved at this time. Please contact support if you have questions.';
          await buyerNotificationSvc.create({
            ownerId: request.buyerId,
            type: 'return_update',
            title: 'Return Request Update',
            message: msg,
            metadata: { returnRequestId: String(requestId), orderId: String(request.orderId) },
          });
          await addEmailJob('buyer-return-update', {
            buyerId: String(request.buyerId),
            orderId: String(request.orderId),
            returnStatus: 'admin_rejected',
            statusMessage: msg,
          });
        } catch (err) {
          console.error('[ReturnService] Buyer notification failed (rejectReturn):', err.message);
        }
      });

      return request.toObject();
    } catch (error) {
      console.error('Something went wrong: Service: returnRequest.rejectReturn', error);
      throw new Error(error.message);
    }
  },

  triggerRefund: async ({ requestId, adminId, adminName }) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(requestId)) throw new Error(constants.databaseMessage.INVALID_ID);
      const request = await ReturnRequest.findById(requestId);
      if (!request) throw new Error(constants.returnMessage.REQUEST_NOT_FOUND);

      if (request.status !== 'admin_approved') {
        throw new Error('Return must be admin_approved before triggering refund');
      }

      request.status = 'refund_initiated';
      addTimeline(request, 'refund_initiated', 'Refund initiated', 'admin', adminId, adminName);
      await request.save();

      let gatewayRefundId;
      try {
        gatewayRefundId = await refundService.processRefund({
          orderId: request.orderId,
          amountCents: request.refundAmountCents,
        });

        request.status = 'refunded';
        request.gatewayRefundId = gatewayRefundId;
        request.resolvedAt = new Date();
        addTimeline(request, 'refunded', `Refund processed. Gateway ID: ${gatewayRefundId}`, 'system', null, 'System');

        setImmediate(async () => {
          try {
            const msg = 'Your refund has been successfully processed and is on its way back to your account.';
            await buyerNotificationSvc.create({
              ownerId: request.buyerId,
              type: 'return_update',
              title: 'Refund Processed',
              message: msg,
              metadata: { returnRequestId: String(request._id), orderId: String(request.orderId), gatewayRefundId },
            });
            await addEmailJob('buyer-return-update', {
              buyerId: String(request.buyerId),
              orderId: String(request.orderId),
              returnStatus: 'refunded',
              statusMessage: msg,
            });
          } catch (err) {
            console.error('[ReturnService] Buyer notification failed (triggerRefund):', err.message);
          }
        });
      } catch (gatewayError) {
        console.error('[ReturnService] Gateway refund error:', gatewayError.message);
        request.status = 'admin_approved'; // roll back so admin can retry
        addTimeline(request, 'admin_approved', `Gateway error: ${gatewayError.message}`, 'system', null, 'System');
        await request.save();
        throw new Error(`${constants.returnMessage.GATEWAY_ERROR}: ${gatewayError.message}`);
      }

      await request.save();
      return request.toObject();
    } catch (error) {
      console.error('Something went wrong: Service: returnRequest.triggerRefund', error);
      throw new Error(error.message);
    }
  },

  closeReturn: async ({ requestId, adminId, adminName, note }) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(requestId)) throw new Error(constants.databaseMessage.INVALID_ID);
      const request = await ReturnRequest.findById(requestId);
      if (!request) throw new Error(constants.returnMessage.REQUEST_NOT_FOUND);

      request.status = 'closed';
      request.adminNote = note || request.adminNote;
      request.resolvedAt = new Date();
      addTimeline(request, 'closed', note || 'Closed by admin', 'admin', adminId, adminName);
      await request.save();

      setImmediate(async () => {
        try {
          const msg = note || 'Your return request has been closed. Thank you for shopping with Oosri.';
          await buyerNotificationSvc.create({
            ownerId: request.buyerId,
            type: 'return_update',
            title: 'Return Request Closed',
            message: msg,
            metadata: { returnRequestId: String(requestId), orderId: String(request.orderId) },
          });
          await addEmailJob('buyer-return-update', {
            buyerId: String(request.buyerId),
            orderId: String(request.orderId),
            returnStatus: 'closed',
            statusMessage: msg,
          });
        } catch (err) {
          console.error('[ReturnService] Buyer notification failed (closeReturn):', err.message);
        }
      });

      return request.toObject();
    } catch (error) {
      console.error('Something went wrong: Service: returnRequest.closeReturn', error);
      throw new Error(error.message);
    }
  },
};
