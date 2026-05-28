const Order = require('../../Buyer/models/buyerOrderModel');
const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const moment = require('moment');
const constants = require('../constants');
const sendEmail = require('../../utils/emailService');
const Buyer = require('../../Buyer/models/buyerAuthModel');
const Cart = require('../../Buyer/models/buyerCartModel');
const Seller = require('../../models/sellerModel');
const { getFxRateNGNtoUSD } = require('../Service/adminControlledFxService');
const mongoose = require('mongoose');
const BuyerNotification = require('../models/buyerNotificationModel');
const SellerNotification = require('../../models/sellerNotificationModel');
const createNotificationService = require('../../utils/notificationService');
const buyerNotifSvc = createNotificationService(BuyerNotification, 'buyerId');
const sellerNotifSvc = createNotificationService(SellerNotification, 'sellerId');
const Payment = require('../models/paymentModel');
const refundService = require('../../utils/refundService');

const fireLowStockAlerts = (deductions) => {
  setImmediate(async () => {
    for (const d of deductions) {
      try {
        if (!d.belowThreshold) continue;
        const product = await Product.findById(d.productId).select('lowStockAlertSent seller lowStockThreshold productName inStock');
        if (!product || product.lowStockAlertSent) continue;
        const seller = await Seller.findById(product.seller).select('email firstName lastName');
        if (!seller?.email) continue;
        await sendEmail.lowStockAlert(
          seller.email,
          `${seller.firstName} ${seller.lastName}`,
          product.productName,
          product.inStock,
          product.lowStockThreshold
        );
        await Product.updateOne({ _id: product._id }, { $set: { lowStockAlertSent: true } });
      } catch (err) {
        console.error(`[LowStockAlert] Failed for product ${d.productId}:`, err.message);
      }
    }
  });
};

module.exports = {
  createOrder: async (serviceData) => {
    try {
      const cart = await Cart.findById(serviceData.cartId)
        .populate({
          path: 'items.productId',
          model: 'Product',
          select: 'productName regularPrice salesPrice images seller'
        });

      if (!cart) {
        throw new Error(constants.buyerOrderMessage.CART_NOT_FOUND);
      }

      if (!cart.items || cart.items.length === 0) {
        throw new Error(constants.buyerOrderMessage.EMPTY_CART);
      }

      let totalAmount = 0;
      const uniqueProducts = new Set();

      const productsData = cart.items
        .filter(item => item.productId)
        .map(item => {
          const productData = item.productId;
          const unitPrice = productData.regularPrice;
          const productTotal = unitPrice * item.quantity;
          totalAmount += productTotal;
          uniqueProducts.add(productData._id.toString());

          return {
            productId: productData._id,
            productName: productData.productName,
            images: productData.images,
            price: unitPrice,
            quantity: item.quantity,
            totalPrice: productTotal,
            sellerId: productData.seller._id
          };
        });

      serviceData.products = productsData;
      serviceData.totalAmount = totalAmount;
      serviceData.totalUniqueProducts = uniqueProducts.size;
      serviceData.userId = cart.userId;

      const user = await Buyer.findById(serviceData.userId).select('email fullName deliveryAddresses');
      if (!user) {
        throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
      }

      serviceData.userEmail = user.email;
      serviceData.fullName = user.fullName;

      if (serviceData.paymentMethod === 'pod') {
        serviceData.paymentStatus = 'pay on delivery';
      } else {
        serviceData.paymentStatus = 'pending';
      }

      const orderDeliveryAddress = {
        address: serviceData.deliveryAddresses.address,
        postalCode: serviceData.deliveryAddresses.postalCode,
        cityName: serviceData.deliveryAddresses.cityName,
        countryCode: serviceData.deliveryAddresses.countryCode,
        countryName: serviceData.deliveryAddresses.countryName,
      };

      serviceData.deliveryAddresses = [orderDeliveryAddress];
      serviceData.currencyCode = 'NGN'; // Legacy cart creates NGN orders

      const session = await mongoose.startSession();
      session.startTransaction();
      
      let result;
      try {
        const inventoryDeductions = [];
        
        for (const item of productsData) {
          const product = await Product.findById(item.productId).session(session);
          if (!product) {
              throw new Error(`Product not found: ${item.productId}`);
          }
          const currentStock = product.inStock ?? 0;
          if (currentStock < item.quantity) {
              throw new Error(`Insufficient stock for ${product.productName}. Requested: ${item.quantity}, Available: ${currentStock}`);
          }
          const isApproved = product.productStatus === 'approved' || product.isApproved === true;
          if (!isApproved || !product.isVisible) {
              throw new Error(`Product ${product.productName} is no longer available for purchase`);
          }

          const updateResult = await Product.findOneAndUpdate(
              { _id: product._id },
              { $inc: { inStock: -item.quantity, total_sales: item.quantity } },
              { new: true, session }
          );

          if (!updateResult) {
              throw new Error(`Failed to deduct inventory for ${product.productName}.`);
          }
          
          inventoryDeductions.push({
              productId: product._id,
              productName: product.productName,
              quantityDeducted: item.quantity,
              previousStock: product.inStock,
              newStock: updateResult.inStock,
              belowThreshold: updateResult.inStock <= (product.lowStockThreshold ?? 5),
          });
        }
        
        serviceData.inventoryDeducted = true;
        serviceData.inventoryDeductionLog = inventoryDeductions;

        const newOrder = new Order({ ...serviceData });
        result = (await newOrder.save({ session }));

        // If it's POD, clear the cart to prevent duplicate checkouts for the same items
        if (serviceData.paymentMethod === 'pod') {
            await Cart.findByIdAndDelete(serviceData.cartId, { session });
        }

        await session.commitTransaction();
        fireLowStockAlerts(inventoryDeductions);
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }

      setImmediate(async () => {
        try {
          const sellerIds = [...new Set(productsData.map(p => p.sellerId.toString()))];
          const nameSnippet = productsData.length === 1
            ? productsData[0].productName
            : `${productsData[0].productName} + ${productsData.length - 1} more`;

          await Promise.all([
            buyerNotifSvc.create({
              ownerId: serviceData.userId,
              type: 'order_placed',
              title: 'Order Placed',
              message: `Your order for ${nameSnippet} has been placed successfully.`,
              metadata: { orderId: result._id },
            }),
            ...sellerIds.map(sellerId =>
              sellerNotifSvc.create({
                ownerId: sellerId,
                type: 'new_order',
                title: 'New Order Received',
                message: `You have a new order: ${nameSnippet}.`,
                metadata: { orderId: result._id },
              })
            ),
          ]);
        } catch (err) {
          console.error('[OrderNotification] create failed:', err.message);
        }
      });

      if (orderDeliveryAddress.address && orderDeliveryAddress.postalCode) {
        const buyer = await Buyer.findById(serviceData.userId);
        if (buyer) {
          const addressExists = buyer.deliveryAddresses.some(addr =>
            addr.address === orderDeliveryAddress.address &&
            addr.postalCode === orderDeliveryAddress.postalCode &&
            addr.cityName === orderDeliveryAddress.cityName &&
            addr.countryCode === orderDeliveryAddress.countryCode
          );

          if (!addressExists) {
            buyer.deliveryAddresses.push(orderDeliveryAddress);
            await buyer.save();
          }
        }
      }

      let savedOrder = await Order.findById(result._id)
        .populate({
          path: 'products.productId',
          select: 'productName regularPrice images'
        });

      let formattedOrder = mongoDbDataFormat.formatMongoData(savedOrder);
      formattedOrder.totalAmount = totalAmount;
      formattedOrder.totalUniqueProducts = uniqueProducts.size;
      const deliveryFee = savedOrder.deliveryFee || 0;
      const grandTotalAmount = totalAmount + deliveryFee;

      // Calculate USD equivalent
      let fxRate = 0;
      try {
        fxRate = await getFxRateNGNtoUSD();
      } catch (fxError) {
        console.warn('Failed to fetch FX rate for order creation:', fxError.message);
      }

      const totalAmountUSD = fxRate ? Number((grandTotalAmount * fxRate).toFixed(2)) : null;
      const deliveryFeeUSD = fxRate ? Number((deliveryFee * fxRate).toFixed(2)) : null;

      const allImages = productsData.flatMap(product => product.images);
      const randomImages = allImages.sort(() => 0.5 - Math.random()).slice(0, 3);

      setImmediate(async () => {
        try {
          const paddedImages = [...randomImages, '', '', ''].slice(0, 3);
          await sendEmail.orderPlaced(serviceData.userEmail, result._id, serviceData.fullName, paddedImages);
        } catch (e) {
          console.error('Order placed email failed:', e.message);
        }
      });

      return {
        orderId: result._id,
        email: serviceData.userEmail,
        deliveryFee,
        deliveryFeeUSD,
        totalAmount: grandTotalAmount,
        totalAmountUSD,
        deliveryAddresses: serviceData.deliveryAddresses,
        fxRate
      };

    } catch (error) {
      console.error('Something went wrong: Service: createOrder', error);
      throw new Error(error.message);
    }
  },

  retrieveBuyerOrders: async (userId, { skip = 0, limit = 10, orderStatus, startDate, endDate }) => {
    try {
      mongoDbDataFormat.checkObjectId(userId);
      skip = parseInt(skip) || 0;
      limit = parseInt(limit) || 10;

      // Build dynamic filter query
      const filter = { userId };

      // Filter by orderStatus if provided
      if (orderStatus) {
        filter.orderStatus = orderStatus;
      }

      // Filter by date range if provided
      if (startDate || endDate) {
        filter.orderDate = {};
        if (startDate) {
          filter.orderDate.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.orderDate.$lte = new Date(endDate);
        }
      }

      // Fetch FX rate for total conversion
      let fxRate = 0;
      try {
        fxRate = await getFxRateNGNtoUSD();
      } catch (fxError) {
        console.warn('Failed to fetch FX rate for buyer orders:', fxError.message);
      }

      // Count total documents for pagination (with filters applied)
      const totalDocs = await Order.countDocuments(filter);

      let orders = await Order.find(filter)
        .populate({
          path: 'products.productId',
          model: 'Product',
          select: 'productName regularPrice salesPrice images productDescription seller',
          populate: {
            path: 'seller',
            select: 'firstName lastName'
          }
        })
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(limit);


      if (!orders || orders.length === 0) {
        return {
          orders: [],
          pagination: {
            totalItems: totalDocs,
            limit,
            currentPage: Math.ceil(skip / limit) + 1,
            totalPages: Math.ceil(totalDocs / limit),
            pagingCounter: skip + 1,
            hasPrevPage: skip > 0,
            hasNextPage: skip + limit < totalDocs,
            prevPage: skip > 0 ? (Math.ceil(skip / limit)) : null,
            nextPage: skip + limit < totalDocs ? (Math.ceil(skip / limit) + 2) : null
          }
        };
      }

      const currencyFormatter = new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
      });

      let formattedOrders = orders.map(order => {
        const isNGN = order.currencyCode === 'NGN';
        
        // Use regularPrice from the populated product — consistent with cart and checkout display.
        const subtotal = order.products.reduce((acc, product) => {
          const unitPrice = (product.productId || {}).regularPrice || 0;
          return acc + unitPrice * (product.quantity || 1);
        }, 0);

        const deliveryFee = order.deliveryFee || 0;
        
        let subtotalNGN, subtotalUSD, deliveryFeeUSD, grandTotalUSD, grandTotalNGN;
        
        if (isNGN) {
            subtotalNGN = subtotal;
            subtotalUSD = fxRate ? Number((subtotal * fxRate).toFixed(2)) : null;
            deliveryFeeUSD = fxRate ? Number((deliveryFee * fxRate).toFixed(2)) : null;
            const grandTotal = subtotal + deliveryFee;
            grandTotalNGN = grandTotal;
            grandTotalUSD = fxRate ? Number((grandTotal * fxRate).toFixed(2)) : null;
        } else {
             // It's a USD-denominated order from Stripe
            subtotalNGN = subtotal;
            subtotalUSD = fxRate ? Number((subtotal * fxRate).toFixed(2)) : null;
            deliveryFeeUSD = deliveryFee; // deliveryFee is already stored as USD for Stripe orders
            grandTotalUSD = subtotalUSD !== null
                ? Number((subtotalUSD + deliveryFeeUSD).toFixed(2))
                : order.totalAmount;
            grandTotalNGN = (fxRate && fxRate > 0) ? Number((grandTotalUSD / fxRate).toFixed(0)) : null;
        }

        const formattedOrderDate = moment(order.orderDate).format('YYYY-MM-DD hh:mm:ss A');

        return {
          orderId: order._id,
          currencyCode: order.currencyCode || 'USD',
          totalAmount: grandTotalNGN,
          totalAmountUSD: grandTotalUSD,
          subtotal: subtotalNGN,
          subtotalUSD: subtotalUSD,
          deliveryFee: isNGN ? deliveryFee : null, // keep backward compat
          deliveryFeeUSD: deliveryFeeUSD,
          shippingProvider: order.shippingProvider || null,
          shipmentStatus: order.shipmentStatus || null,
          estimatedDeliveryDate: order.estimatedDeliveryDate || null,
          orderDate: formattedOrderDate,
          deliveryAddress: order.deliveryAddresses?.[order.deliveryAddresses.length - 1] || {},
          orderStatus: order.orderStatus,
          landMark: order.landMark || '',
          fxRate: fxRate || null,
          products: order.products.map(product => {
            const productData = product.productId || {};
            return {
              productName: productData.productName || 'Unknown Product',
              productDescription: productData.productDescription || '',
              sellerName: productData.seller ? `${productData.seller.firstName} ${productData.seller.lastName}` : 'Unknown Seller',
              images: productData.images || [],
            };
          })
        };
      });

      return {
        orders: formattedOrders,
        pagination: {
          totalItems: totalDocs,
          limit,
          currentPage: Math.floor(skip / limit) + 1,
          totalPages: Math.ceil(totalDocs / limit),
          pagingCounter: skip + 1,
          hasPrevPage: skip > 0,
          hasNextPage: skip + limit < totalDocs,
          prevPage: skip > 0 ? (Math.floor(skip / limit)) : null,
          nextPage: skip + limit < totalDocs ? (Math.floor(skip / limit) + 2) : null
        }
      };
    } catch (error) {
      console.error('Something went wrong: Service: retrieveBuyerOrders', error);
      throw new Error(error.message);
    }
  },



  buyerCancelOrder: async (orderId, userId) => {
    try {
      mongoDbDataFormat.checkObjectId(orderId);
      mongoDbDataFormat.checkObjectId(userId);

      const order = await Order.findOne({ _id: orderId, userId });
      if (!order) {
        throw new Error(constants.buyerOrderMessage.UNAUTHORIZED_ORDER);
      }

      const cancellableStatuses = ['pending', 'processing', 'pending_logistics'];
      if (!cancellableStatuses.includes(order.orderStatus)) {
        throw new Error(constants.buyerOrderMessage.CANCELLATION_NOT_ALLOWED);
      }

      // If the order was already paid, issue a refund via the correct gateway
      if (order.paymentStatus === 'paid') {
        const payment = await Payment.findOne({ order_id: orderId });
        const gateway = payment?.gateway;

        if (gateway === 'paystack') {
          try {
            await refundService.processRefund({ orderId });
            // refundService updates paymentStatus on the Order doc via updateOne;
            // reload the status here so our subsequent save doesn't overwrite it.
            order.orderStatus = 'canceled';
            order.paymentStatus = 'refunded';
            const updatedOrder = await order.save();

            setImmediate(async () => {
              try {
                await buyerNotifSvc.create({
                  ownerId: order.userId,
                  type: 'order_cancelled',
                  title: 'Order Cancelled',
                  message: 'Your order has been cancelled and your refund is on its way.',
                  metadata: { orderId: order._id },
                });
              } catch (err) {
                console.error('[OrderNotification] cancel failed:', err.message);
              }
            });

            return updatedOrder.orderStatus;
          } catch (paystackError) {
            console.error('Failed to issue Paystack refund during cancellation:', paystackError);
            throw new Error('Failed to process refund: ' + paystackError.message);
          }
        }

        // Stripe: submit refund and let the webhook update order status
        if (order.paymentIntentId) {
          try {
            const stripe = require('stripe')(process.env.STRIPE_PAYMENT_TEST_KEY);
            await stripe.refunds.create({
              payment_intent: order.paymentIntentId,
              metadata: { reason: 'Buyer canceled order', orderId: order._id.toString() },
            });
            return 'cancellation_pending_refund';
          } catch (stripeError) {
            console.error('Failed to issue Stripe refund during cancellation:', stripeError);
            throw new Error('Failed to process refund: ' + stripeError.message);
          }
        }
      }

      order.orderStatus = 'canceled';
      // If it wasn't paid yet, or it's a POD order, just mark it canceled.
      if (order.paymentStatus !== 'paid') {
          order.paymentStatus = 'canceled';
      }
      
      const updatedOrder = await order.save();

      setImmediate(async () => {
        try {
          await buyerNotifSvc.create({
            ownerId: order.userId,
            type: 'order_cancelled',
            title: 'Order Cancelled',
            message: 'Your order has been cancelled successfully.',
            metadata: { orderId: order._id },
          });
        } catch (err) {
          console.error('[OrderNotification] cancel failed:', err.message);
        }
      });

      return updatedOrder.orderStatus;

    } catch (error) {
      console.error('Something went wrong: Service: buyerCancelOrders', error);
      throw new Error(error.message);
    }
  },

  retrieveSellerOrders: async (sellerId, { skip = 0, limit = 10 }) => {
    try {
      mongoDbDataFormat.checkObjectId(sellerId);
      skip = parseInt(skip);
      limit = parseInt(limit);

      const productIds = await mongoDbDataFormat.getProductsBySeller(sellerId);
      if (!productIds || productIds.length === 0) {
        throw new Error('SellerId not recognized');
      }

      let orders = await Order.find({ 'products.productId': { $in: productIds } })
        .populate({
          path: 'userId',
          select: 'fullName'
        })
        .skip(skip)
        .limit(limit);


      if (!orders || orders.length === 0) {
        return [];
      }

      const currencyFormatter = new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
      });

      const formattedOrders = orders.map(order => {
        const formattedOrderDate = moment(order.orderDate).format('YYYY-MM-DD hh:mm:ss A');
        const deliveryFee = order.deliveryFee || 0;
        // Calculate NGN total from products as totalAmount in DB is USD
        const totalAmountNGN = order.products.reduce((acc, p) => acc + (p.totalPrice || 0), 0) + deliveryFee;

        return {
          orderId: order._id,
          customerFullName: order.userId.fullName || '',
          totalAmount: totalAmountNGN,
          orderDate: formattedOrderDate,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
        };
      });

      return formattedOrders;

    } catch (error) {
      console.error('Something went wrong: Service: retrieveSellerOrders', error);
      throw new Error(error.message);
    }
  },



  retrieveOrderById: async (orderId, userId) => {
    try {

      mongoDbDataFormat.checkObjectId(orderId);
      mongoDbDataFormat.checkObjectId(userId);
      const order = await Order.findOne({ _id: orderId, userId })
        .populate({
          path: 'userId',
          select: 'fullName profileImage'
        })
        .populate({
          path: 'products.productId',
          select: 'productName images regularPrice productDescription productBrand color condition productType dimension'
        })
        .populate({
          path: 'products.sellerId',
          select: 'firstName lastName'
        });


      if (!order) {
        throw new Error(constants.buyerOrderMessage.UNAUTHORIZED_ORDER);
      }


      // ─── Currency Normalization ──────────────────────────────────────────────
      const deliveryFee = order.deliveryFee || 0; 

      let fxRate = 0;
      try {
        fxRate = await getFxRateNGNtoUSD();
      } catch (fxError) {
        console.warn('Failed to fetch FX rate for order details:', fxError.message);
      }

      const isNGN = order.currencyCode === 'NGN';
      let subtotalNGN, subtotalUSD, deliveryFeeUSD, grandTotalUSD, grandTotalNGN;
      
      const subtotal = order.products.reduce((acc, p) => {
        const unitPrice = p.productId?.regularPrice || 0;
        return acc + unitPrice * (p.quantity || 1);
      }, 0);
      
      if (isNGN) {
          subtotalNGN = subtotal;
          subtotalUSD = fxRate ? Number((subtotal * fxRate).toFixed(2)) : null;
          deliveryFeeUSD = fxRate ? Number((deliveryFee * fxRate).toFixed(2)) : null;
          const grandTotal = subtotal + deliveryFee;
          grandTotalNGN = grandTotal;
          grandTotalUSD = fxRate ? Number((grandTotal * fxRate).toFixed(2)) : null;
      } else {
          subtotalNGN = subtotal;
          subtotalUSD = fxRate ? Number((subtotal * fxRate).toFixed(2)) : null;
          deliveryFeeUSD = deliveryFee;
          grandTotalUSD = subtotalUSD !== null
              ? Number((subtotalUSD + deliveryFeeUSD).toFixed(2))
              : order.totalAmount;
          grandTotalNGN = (fxRate && fxRate > 0) ? Number((grandTotalUSD / fxRate).toFixed(0)) : null;
      }

      const formattedOrderDate = moment(order.orderDate).format('YYYY-MM-DD hh:mm:ss A');

      const sellerNames = [...new Set(
        order.products
          .filter(p => p.sellerId)
          .map(p => `${p.sellerId.firstName} ${p.sellerId.lastName}`.trim())
      )];

      const formattedOrder = {
        orderId: order._id,
        customerFullName: order.userId.fullName,
        customerProfileImage: order.userId.profileImage,
        sellerNames,
        products: order.products.map(product => {
          const unitPrice = product.productId?.regularPrice || 0;
          const qty = product.quantity || 1;
          const pAmountNGN = unitPrice * qty;
          return {
            productId: product.productId._id,
            productName: product.productId.productName,
            productDescription: product.productId.productDescription || '',
            productBrand: product.productId.productBrand || '',
            color: product.productId.color || '',
            condition: product.productId.condition || '',
            productType: product.productId.productType || '',
            dimension: product.productId.dimension || '',
            productImage: product.productId.images,
            quantity: qty,
            productAmount: pAmountNGN,
            productAmountUSD: fxRate ? Number((pAmountNGN * fxRate).toFixed(2)) : null,
          };
        }),
        deliveryAddress: order.deliveryAddresses?.[order.deliveryAddresses.length - 1] || {},
        phoneNumber: order.phoneNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        landMark: order.landMark || '',
        orderDate: formattedOrderDate,
        subtotal: subtotalNGN,            
        subtotalUSD: subtotalUSD,      
        deliveryFee: isNGN ? deliveryFee : null,      
        deliveryFeeUSD: deliveryFeeUSD, 
        totalAmount: grandTotalNGN,    
        totalAmountUSD: grandTotalUSD,
        shippingProvider: order.shippingProvider || null,
        shippingServiceName: order.shippingServiceName || null,
        shipmentStatus: order.shipmentStatus || null,
        estimatedDeliveryDate: order.estimatedDeliveryDate || null,
        fxRate: fxRate || null,
        currencyCode: order.currencyCode || 'USD',
      };

      return formattedOrder;

    } catch (error) {
      console.error('Something went wrong: Service: retrieveOrderById', error);
      throw new Error(error.message);
    }
  },

  handlePaymentResult: async (orderId, paymentStatus) => {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error(constants.buyerOrderMessage.INVALID_ORDER_ID);
      }

      if (paymentStatus === 'success') {
        order.paymentStatus = 'paid';
        order.orderStatus = 'processing';
        await order.save();

        await Cart.findOneAndDelete({ userId: order.userId });

        setImmediate(async () => {
          try {
            await buyerNotifSvc.create({
              ownerId: order.userId,
              type: 'order_placed',
              title: 'Payment Confirmed',
              message: 'Your payment was successful and your order is now being processed.',
              metadata: { orderId: order._id },
            });
          } catch (err) {
            console.error('[OrderNotification] payment confirm failed:', err.message);
          }
        });

        return {
          success: true,
          message: constants.buyerOrderMessage.PAYMENT_SUCCESSFUL
        };
      } else {
        order.paymentStatus = 'failed';
        order.orderStatus = 'on-hold';
        await order.save();

        setImmediate(async () => {
          try {
            await buyerNotifSvc.create({
              ownerId: order.userId,
              type: 'system',
              title: 'Payment Failed',
              message: 'Your payment could not be processed. Please try again or contact support.',
              metadata: { orderId: order._id },
            });
          } catch (err) {
            console.error('[OrderNotification] payment failed notify error:', err.message);
          }
        });

        return {
          success: false,
          message: constants.buyerOrderMessage.PAYMENT_FAILED
        };
      }
    } catch (error) {
      console.error('Something went wrong: Order handlePaymentResult', error);
      throw new Error('Failed to update order payment status: ' + error.message);
    }
  },
  retrieveUserDeliveryAddresses: async (userId) => {
    try {
      mongoDbDataFormat.checkObjectId(userId);

      const buyer = await Buyer.findById(userId).select('deliveryAddresses');
      if (!buyer) {
        throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
      }

      const formattedAddresses = buyer.deliveryAddresses.map(addr => ({
        address: addr.address,
        postalCode: addr.postalCode
      }));

      return {
        addresses: formattedAddresses
      };
    } catch (error) {
      console.error('Something went wrong: Service: retrieveUserDeliveryAddresses', error);
      throw new Error(error.message);
    }
  }

}



