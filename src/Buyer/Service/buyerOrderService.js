const Order = require('../../Buyer/models/buyerOrderModel');
const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const moment = require('moment');
const constants = require('../constants');
const sendEmail = require('../../utils/emailService');
const Buyer = require('../../Buyer/models/buyerAuthModel')
const Cart = require('../../Buyer/models/buyerCartModel');
const { getFxRateNGNtoUSD } = require('../Service/fxService');




module.exports = {
  createOrder: async (serviceData) => {
    try {
      const cart = await Cart.findById(serviceData.cartId)
        .populate({
          path: 'items.productId',
          model: 'Product',
          select: 'productName regularPrice images seller'
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
          const productTotal = productData.regularPrice * item.quantity;
          totalAmount += productTotal;
          uniqueProducts.add(productData._id.toString());

          return {
            productId: productData._id,
            productName: productData.productName,
            images: productData.images,
            price: productData.regularPrice,
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

      const newOrder = new Order({ ...serviceData });
      const result = await newOrder.save();

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

      //  await sendEmail.orderPlaced(serviceData.userEmail, result._id, serviceData.fullName, randomImages);

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
          select: 'productName regularPrice images productDescription seller',
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
        const subtotal = order.products.reduce((acc, product) => {
          const productData = product.productId || {};
          return acc + (productData.regularPrice * product.quantity);
        }, 0);

        const deliveryFee = order.deliveryFee || 0;
        const grandTotal = order.totalAmount + deliveryFee;

        const formattedOrderDate = moment(order.orderDate).format('YYYY-MM-DD hh:mm:ss A');

        return {
          orderId: order._id,
          totalAmount: order.totalAmount + deliveryFee,
          totalAmountUSD: fxRate ? Number((grandTotal * fxRate).toFixed(2)) : null,
          subtotal: subtotal,
          subtotalUSD: fxRate ? Number((subtotal * fxRate).toFixed(2)) : null,
          deliveryFee: deliveryFee,
          deliveryFeeUSD: fxRate ? Number((deliveryFee * fxRate).toFixed(2)) : null,
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
      console.log('Something went wrong: Service: retrieveBuyerOrders', error);
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

      const cancellableStatuses = ['pending', 'processing'];
      if (!cancellableStatuses.includes(order.orderStatus)) {
        throw new Error(constants.buyerOrderMessage.CANCELLATION_NOT_ALLOWED);
      }

      order.orderStatus = 'canceled';
      const updatedOrder = await order.save();

      return updatedOrder.orderStatus;

    } catch (error) {
      console.log('Something went wrong: Service: buyerCancelOrders', error);
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
      console.log('Something went wrong: Service: retrieveSellerOrders', error);
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
          select: 'productName images regularPrice productDescription productBrand color condition productType dimension'
        })
        .populate({
          path: 'products.sellerId',
          select: 'firstName lastName'
        });


      if (!order) {
        throw new Error(constants.buyerOrderMessage.INVALID_ORDER_ID);
      }


      // ─── Currency note ───────────────────────────────────────────────────────
      // order.totalAmount  (DB) = payment.gross_amount_cents / 100  → USD (Stripe product cost)
      // order.deliveryFee  (DB) = shippingFeeUSD                    → USD (DHL quote at checkout)
      // product.totalPrice (DB) = priceNGN × quantity               → NGN
      //
      // fxRate = USD/NGN  (e.g. 0.000732) — only valid for NGN → USD conversion.
      // Applying fxRate to already-USD values produces nonsense (USD × USD/NGN).
      // ─────────────────────────────────────────────────────────────────────────

      const deliveryFee = order.deliveryFee || 0;                // USD (already)
      const grandTotalUSD = Number((order.totalAmount + deliveryFee).toFixed(2)); // USD product + USD shipping

      let fxRate = 0;
      try {
        fxRate = await getFxRateNGNtoUSD();
      } catch (fxError) {
        console.warn('Failed to fetch FX rate for order details:', fxError.message);
      }

      // subtotal is the only NGN value — fxRate conversion is correct here
      const subtotal = order.products.reduce((acc, p) => acc + (p.totalPrice || 0), 0); // NGN
      const subtotalUSD = fxRate ? Number((subtotal * fxRate).toFixed(2)) : null;           // USD ✓

      const formattedOrderDate = moment(order.orderDate).format('YYYY-MM-DD hh:mm:ss A');

      const formattedOrder = {
        orderId: order._id,
        customerFullName: order.userId.fullName,
        customerProfileImage: order.userId.profileImage,
        sellerFullName: order.products[0]?.sellerId?.firstName + ' ' + order.products[0]?.sellerId?.lastName || '',
        products: order.products.map(product => ({
          productId: product.productId._id,
          productName: product.productId.productName,
          productDescription: product.productId.productDescription || '',
          productBrand: product.productId.productBrand || '',
          color: product.productId.color || '',
          condition: product.productId.condition || '',
          productType: product.productId.productType || '',
          dimension: product.productId.dimension || '',
          productImage: product.productId.images,
          productAmount: product.totalPrice,                                            // NGN
          productAmountUSD: fxRate ? Number((product.totalPrice * fxRate).toFixed(2)) : null, // USD ✓
        })),
        deliveryAddress: order.deliveryAddresses?.[order.deliveryAddresses.length - 1] || {},
        phoneNumber: order.phoneNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        landMark: order.landMark || '',
        orderDate: formattedOrderDate,
        subtotal: subtotal,            // NGN product cost
        subtotalUSD: subtotalUSD,      // USD product cost (NGN × fxRate) ✓
        deliveryFee: deliveryFee,      // USD shipping fee (from DHL, stored as USD) ✓
        totalAmount: grandTotalUSD,    // USD grand total (product USD + shipping USD) ✓
        fxRate: fxRate || null
        // NOTE: deliveryFeeUSD and totalAmountUSD have been removed.
        // They were computed as USD × fxRate which produces dimensionally incorrect values.
        // Use deliveryFee and totalAmount directly — both are already in USD.
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

        return {
          success: true,
          message: constants.buyerOrderMessage.PAYMENT_SUCCESSFUL
        };
      } else {
        order.paymentStatus = 'failed';
        order.orderStatus = 'on-hold';
        await order.save();

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
      console.log('Something went wrong: Service: retrieveUserDeliveryAddresses', error);
      throw new Error(error.message);
    }
  }

}





