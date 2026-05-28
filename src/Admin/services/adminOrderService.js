const Order = require('../../Buyer/models/buyerOrderModel');
const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const moment = require('moment');
const constants = require('../constants');
const sendEmail = require('../../utils/emailService');
const Buyer = require('../../Buyer/models/buyerAuthModel');
const Seller = require('../../models/sellerModel');
const escapeRegex = require('../../utils/escapeRegex');
const { getFxRateNGNtoUSD } = require('../../Buyer/Service/adminControlledFxService');
const BuyerNotification = require('../../Buyer/models/buyerNotificationModel');
const createNotificationService = require('../../utils/notificationService');
const buyerNotifSvc = createNotificationService(BuyerNotification, 'buyerId');

const STATUS_NOTIFICATION = {
  processing:        { type: 'order_placed',    title: 'Order Confirmed',   message: 'Your payment is confirmed and your order is being processed.' },
  pending_logistics: { type: 'order_shipped',   title: 'Order Shipped',     message: 'Great news! Your order is on its way.' },
  completed:         { type: 'order_delivered', title: 'Order Delivered',   message: 'Your order has been delivered. Thank you for shopping with us!' },
  canceled:          { type: 'order_cancelled', title: 'Order Cancelled',   message: 'Your order has been cancelled by our team.' },
  'on-hold':         { type: 'system',          title: 'Order On Hold',     message: 'Your order is temporarily on hold. Our team will contact you shortly.' },
};




module.exports = {


  retrieveAllOrders: async ({ skip = 0, limit = 10, filters = {} }) => {
    try {
      skip = parseInt(skip);
      limit = parseInt(limit);

      const query = {};

      if (filters.orderStatus) query.orderStatus = filters.orderStatus;
      if (filters.buyerId) query.userId = filters.buyerId;

      // Date range
      let startDate = null;
      let endDate = null;
      switch (filters.dateFilter) {
        case 'thisWeek':  startDate = moment().startOf('week');  endDate = moment().endOf('week');  break;
        case 'lastWeek':  startDate = moment().subtract(1,'weeks').startOf('week');  endDate = moment().subtract(1,'weeks').endOf('week');  break;
        case 'thisMonth': startDate = moment().startOf('month'); endDate = moment().endOf('month'); break;
        case 'lastMonth': startDate = moment().subtract(1,'months').startOf('month'); endDate = moment().subtract(1,'months').endOf('month'); break;
        case 'thisYear':  startDate = moment().startOf('year');  endDate = moment().endOf('year');  break;
        case 'lastYear':  startDate = moment().subtract(1,'years').startOf('year');  endDate = moment().subtract(1,'years').endOf('year');  break;
      }
      if (filters.fromDate && filters.toDate) {
        startDate = moment(filters.fromDate);
        endDate   = moment(filters.toDate).endOf('day');
      }
      if (startDate && endDate) {
        query.orderDate = { $gte: startDate.toDate(), $lte: endDate.toDate() };
      }

      // Name filters — pre-lookup IDs so filtering happens at DB level
      if (filters.customerName) {
        const regex = new RegExp(escapeRegex(filters.customerName.trim()), 'i');
        const buyers = await Buyer.find({ fullName: regex }).select('_id');
        query.userId = { $in: buyers.map(b => b._id) };
      }
      if (filters.sellerName) {
        const regex = new RegExp(escapeRegex(filters.sellerName.trim()), 'i');
        const sellers = await Seller.find({
          $or: [{ firstName: regex }, { lastName: regex }]
        }).select('_id');
        query['products.sellerId'] = { $in: sellers.map(s => s._id) };
      }

      const currencyFormatterNGN = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 });
      const currencyFormatterUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

      const [total, orders] = await Promise.all([
        Order.countDocuments(query),
        Order.find(query)
          .populate({ path: 'userId', select: 'fullName' })
          .populate({ path: 'products.sellerId', select: 'firstName lastName' })
          .sort({ orderDate: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      const formattedOrders = orders.map(order => {
        const isUSD = (order.currencyCode || 'NGN') === 'USD';
        const productSubtotalNGN = order.products.reduce((acc, p) => acc + (p.totalPrice || 0), 0);
        const totalAmountUSD = isUSD ? (order.totalAmount || 0) : 0;
        const totalAmountNGN = isUSD ? productSubtotalNGN : (order.totalAmount || productSubtotalNGN);
        const sellerNames = [...new Set(
          order.products.map(p => p.sellerId
            ? `${p.sellerId.firstName} ${p.sellerId.lastName}`
            : 'Unknown Seller'
          )
        )];
        return {
          orderId: order._id,
          customerFullName: order.userId?.fullName || '',
          sellerNames,
          currencyCode: order.currencyCode || 'NGN',
          totalAmountUSD,
          totalAmountNGN,
          formattedAmountUSD: currencyFormatterUSD.format(totalAmountUSD),
          formattedAmountNGN: currencyFormatterNGN.format(totalAmountNGN),
          totalAmount: isUSD
            ? currencyFormatterUSD.format(totalAmountUSD)
            : currencyFormatterNGN.format(totalAmountNGN),
          orderDate: moment(order.orderDate).format('YYYY-MM-DD hh:mm:ss A'),
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          itemNum: order.products.length,
        };
      });

      return {
        orders: formattedOrders,
        total,
        currentPage: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit) || 1,
      };

    } catch (error) {
      console.error('Something went wrong: Service: retrieveAllOrders', error);
      throw new Error(error.message);
    }
  },

  retrieveOrderById: async (orderId) => {
    try {

      mongoDbDataFormat.checkObjectId(orderId);
      const order = await Order.findById(orderId)
        .populate({
          path: 'userId',
          select: 'fullName profileImage'
        })
        .populate({
          path: 'products.productId',
          select: 'productName images price'
        })
        .populate({
          path: 'products.sellerId',
          select: 'firstName lastName'
        });


      if (!order) {
        throw new Error(constants.buyerOrderMessage.INVALID_ORDER_ID);
      }


      const isUSD = (order.currencyCode || 'NGN') === 'USD';
      const formattedOrderDate = moment(order.orderDate).format('YYYY-MM-DD hh:mm:ss A');
      const deliveryFee = order.deliveryFee || 0;

      const currencyFormatterNGN = new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
      });
      const currencyFormatterUSD = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      });

      // Products always store NGN prices regardless of order currency
      const productSubtotalNGN = order.products.reduce((acc, p) => acc + (p.totalPrice || 0), 0);

      // For USD orders: totalAmount is the USD grand total (set by Stripe, includes delivery)
      // For NGN orders: totalAmount is the NGN grand total
      const grandTotalUSD = isUSD ? (order.totalAmount || 0) : 0;
      const grandTotalNGN = isUSD ? productSubtotalNGN : (order.totalAmount || productSubtotalNGN);

      // Delivery fee is stored in the order's native currency
      const deliveryFeeUSD = isUSD ? deliveryFee : 0;
      const deliveryFeeNGN = isUSD ? 0 : deliveryFee;

      // Product subtotal (without delivery)
      const subtotalUSD = isUSD ? Math.max(0, grandTotalUSD - deliveryFeeUSD) : 0;
      const subtotalNGN = isUSD ? productSubtotalNGN : Math.max(0, grandTotalNGN - deliveryFeeNGN);

      // Per-product USD: proportional split from USD subtotal
      const products = order.products.map(product => {
        const productAmountNGN = product.totalPrice || 0;
        const productAmountUSD = (isUSD && productSubtotalNGN > 0)
          ? (productAmountNGN / productSubtotalNGN) * subtotalUSD
          : 0;
        return {
          productId: product.productId._id,
          productName: product.productId.productName,
          productImage: product.productId.images,
          quantity: product.quantity,
          productAmountNGN,
          productAmountUSD,
          formattedProductAmountNGN: currencyFormatterNGN.format(productAmountNGN),
          formattedProductAmountUSD: currencyFormatterUSD.format(productAmountUSD),
          productAmount: isUSD
            ? currencyFormatterUSD.format(productAmountUSD)
            : currencyFormatterNGN.format(productAmountNGN),
        };
      });

      const sellerNames = [...new Set(
        order.products
          .filter(p => p.sellerId)
          .map(p => `${p.sellerId.firstName} ${p.sellerId.lastName}`.trim())
      )];

      const formattedOrder = {
        orderId: order._id,
        currencyCode: order.currencyCode || 'NGN',
        customerFullName: order.userId.fullName,
        customerProfileImage: order.userId.profileImage,
        paymentStatus: order.paymentStatus,
        sellerFullName: sellerNames[0] || '—',
        sellerNames,
        products,
        deliveryAddress: order.deliveryAddresses?.[0]
          ? [order.deliveryAddresses[0].address, order.deliveryAddresses[0].cityName, order.deliveryAddresses[0].countryName].filter(Boolean).join(', ')
          : order.deliveryAddress,
        phoneNumber: order.phoneNumber,
        orderStatus: order.orderStatus,
        orderDate: formattedOrderDate,
        // Delivery fee in native currency
        deliveryFeeNGN,
        deliveryFeeUSD,
        formattedDeliveryFeeNGN: currencyFormatterNGN.format(deliveryFeeNGN),
        formattedDeliveryFeeUSD: currencyFormatterUSD.format(deliveryFeeUSD),
        // Subtotals (products only, before delivery)
        subtotalNGN,
        subtotalUSD,
        formattedSubtotalNGN: currencyFormatterNGN.format(subtotalNGN),
        formattedSubtotalUSD: currencyFormatterUSD.format(subtotalUSD),
        // Grand totals
        totalAmountNGN: grandTotalNGN,
        totalAmountUSD: grandTotalUSD,
        formattedAmountNGN: currencyFormatterNGN.format(grandTotalNGN),
        formattedAmountUSD: currencyFormatterUSD.format(grandTotalUSD),
        totalAmount: isUSD
          ? currencyFormatterUSD.format(grandTotalUSD)
          : currencyFormatterNGN.format(grandTotalNGN),
      };

      return formattedOrder;

    } catch (error) {
      console.error('Something went wrong: Service: retrieveOrderById', error);
      throw new Error(error.message);
    }
  },

  searchOrders: async ({ searchTerm = '', skip = 0, limit = 10 }) => {
    try {
      skip = parseInt(skip);
      limit = parseInt(limit);

      const term = searchTerm.trim();
      const query = {};

      if (term) {
        const regex = new RegExp(escapeRegex(term), 'i');
        const [buyers, sellers] = await Promise.all([
          Buyer.find({ fullName: regex }).select('_id'),
          Seller.find({ $or: [{ firstName: regex }, { lastName: regex }] }).select('_id'),
        ]);
        const conditions = [{ orderStatus: regex }];
        if (buyers.length)  conditions.push({ userId: { $in: buyers.map(b => b._id) } });
        if (sellers.length) conditions.push({ 'products.sellerId': { $in: sellers.map(s => s._id) } });
        query.$or = conditions;
      }

      const currencyFormatterNGN = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 });
      const currencyFormatterUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

      const [total, orders] = await Promise.all([
        Order.countDocuments(query),
        Order.find(query)
          .populate({ path: 'userId', select: 'fullName' })
          .populate({ path: 'products.sellerId', select: 'firstName lastName' })
          .sort({ orderDate: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      const formattedOrders = orders.map(order => {
        const isUSD = (order.currencyCode || 'NGN') === 'USD';
        const productSubtotalNGN = order.products.reduce((acc, p) => acc + (p.totalPrice || 0), 0);
        const totalAmountUSD = isUSD ? (order.totalAmount || 0) : 0;
        const totalAmountNGN = isUSD ? productSubtotalNGN : (order.totalAmount || productSubtotalNGN);
        const sellerNames = [...new Set(
          order.products.map(p => p.sellerId
            ? `${p.sellerId.firstName} ${p.sellerId.lastName}`
            : 'Unknown Seller'
          )
        )];
        return {
          orderId: order._id,
          customerFullName: order.userId?.fullName || '',
          sellerNames,
          currencyCode: order.currencyCode || 'NGN',
          totalAmountUSD,
          totalAmountNGN,
          formattedAmountNGN: currencyFormatterNGN.format(totalAmountNGN),
          formattedAmountUSD: currencyFormatterUSD.format(totalAmountUSD),
          totalAmount: isUSD
            ? currencyFormatterUSD.format(totalAmountUSD)
            : currencyFormatterNGN.format(totalAmountNGN),
          orderDate: moment(order.orderDate).format('YYYY-MM-DD hh:mm:ss A'),
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          itemNum: order.products.length,
        };
      });

      return {
        orders: formattedOrders,
        total,
        currentPage: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit) || 1,
      };
    } catch (error) {
      console.error('Something went wrong: Service: searchOrders', error);
      throw new Error('Failed to search orders');
    }
  },



  updateOrderStatus: async (orderId, newStatus) => {
    try {
      mongoDbDataFormat.checkObjectId(orderId);

      const order = await Order.findById(orderId).populate({
        path: 'userId',
        model: 'Buyer',
        select: 'email fullName'
      });

      if (!order) {
        throw new Error(constants.adminOrderMessage.INVALID_ORDER_ID);
      }

      const previousStatus = order.orderStatus;

      await Order.updateOne(
        { _id: orderId },
        { $set: { orderStatus: newStatus } }
      );

      order.orderStatus = newStatus; // update the local object so subsequent uses (like return) remain correct.

      console.log(`[AdminOrderService] Order ${orderId} status updated: ${previousStatus} → ${newStatus}`);

      setImmediate(async () => {
        const buyerEmail = order.userId?.email;
        const buyerName = order.userId?.fullName;
        const buyerId = order.userId?._id;

        const notif = STATUS_NOTIFICATION[newStatus] || {
          type: 'system',
          title: 'Order Update',
          message: `Your order status has been updated to "${newStatus}".`,
        };

        await Promise.allSettled([
          buyerEmail
            ? sendEmail.orderStatusUpdate(buyerEmail, buyerName, orderId, newStatus)
            : Promise.resolve(),
          buyerId
            ? buyerNotifSvc.create({
                ownerId: buyerId,
                type: notif.type,
                title: notif.title,
                message: notif.message,
                metadata: { orderId },
              })
            : Promise.resolve(),
        ]).then(results => {
          results.forEach((r, i) => {
            if (r.status === 'rejected') {
              console.error(`[AdminOrderService] Post-status-update task ${i} failed:`, r.reason?.message);
            }
          });
        });
      });

      return {
        orderId: order._id,
        previousStatus,
        orderStatus: newStatus
      };

    } catch (error) {
      console.error('Something went wrong: Service: updateOrderStatus', error);
      throw new Error(error.message);
    }
  }

}
