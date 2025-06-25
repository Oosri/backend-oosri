const Order = require('../../Buyer/models/buyerOrderModel');
const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const moment = require('moment');
const constants = require('../constants');
const sendEmail = require('../../utils/emailService');
const Buyer = require('../../Buyer/models/buyerAuthModel')




module.exports ={
   

   retrieveAllOrders: async ({ skip = 0, limit = 10, filters = {} }) => {
  try {
    skip = parseInt(skip);
    limit = parseInt(limit);

    const query = {};

    if (filters.orderStatus) {
      query.orderStatus = filters.orderStatus;
    }

    let startDate = null;
    let endDate = null;

    switch (filters.dateFilter) {
      case 'thisWeek':
        startDate = moment().startOf('week');
        endDate = moment().endOf('week');
        break;
      case 'lastWeek':
        startDate = moment().subtract(1, 'weeks').startOf('week');
        endDate = moment().subtract(1, 'weeks').endOf('week');
        break;
      case 'thisMonth':
        startDate = moment().startOf('month');
        endDate = moment().endOf('month');
        break;
      case 'lastMonth':
        startDate = moment().subtract(1, 'months').startOf('month');
        endDate = moment().subtract(1, 'months').endOf('month');
        break;
      case 'thisYear':
        startDate = moment().startOf('year');
        endDate = moment().endOf('year');
        break;
      case 'lastYear':
        startDate = moment().subtract(1, 'years').startOf('year');
        endDate = moment().subtract(1, 'years').endOf('year');
        break;
    }

    if (filters.fromDate && filters.toDate) {
      startDate = moment(filters.fromDate);
      endDate = moment(filters.toDate).endOf('day');
    }

    if (startDate && endDate) {
      query.orderDate = { $gte: startDate.toDate(), $lte: endDate.toDate() };
    }

    const allMatchingOrders = await Order.find(query)
      .populate({
        path: 'userId',
        select: 'fullName'
      })
      .populate({
        path: 'products.sellerId',
        select: 'firstName lastName'
      });

    if (!allMatchingOrders || allMatchingOrders.length === 0) {
      return {
        orders: [],
        total: 0,
        currentPage: 1,
        totalPages: 1
      };
    }

    const currencyFormatter = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    });

    const filteredOrders = allMatchingOrders.filter(order => {
      let isMatch = true;

      if (filters.customerName) {
        const fullName = order.userId?.fullName?.toLowerCase() || '';
        isMatch = isMatch && fullName.includes(filters.customerName.toLowerCase());
      }

      if (filters.sellerName) {
        const sellerNames = order.products.map(p =>
          p.sellerId
            ? `${p.sellerId.firstName} ${p.sellerId.lastName}`.toLowerCase()
            : 'unknown seller'
        );
        isMatch = isMatch && sellerNames.some(name => name.includes(filters.sellerName.toLowerCase()));
      }

      return isMatch;
    });

    const total = filteredOrders.length;
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(skip / limit) + 1;

    const paginatedOrders = filteredOrders.slice(skip, skip + limit);

    const formattedOrders = paginatedOrders.map(order => {
      const formattedOrderDate = moment(order.orderDate).format('YYYY-MM-DD hh:mm:ss A');
      const deliveryFee = order.deliveryFee || 0;
      const totalAmount = +order.totalAmount + deliveryFee;

      const sellerNames = [
        ...new Set(
          order.products.map(p =>
            p.sellerId
              ? `${p.sellerId.firstName} ${p.sellerId.lastName}`
              : 'Unknown Seller'
          )
        ),
      ];

      return {
        orderId: order._id,
        customerFullName: order.userId?.fullName || '',
        sellerNames: sellerNames,
        totalAmount: currencyFormatter.format(totalAmount),
        orderDate: formattedOrderDate,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
      };
    });

    return {
      orders: formattedOrders,
      total,
      currentPage,
      totalPages
    };

  } catch (error) {
    console.log('Something went wrong: Service: retrieveAllOrders', error);
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


            const formattedOrderDate = moment(order.orderDate).format('YYYY-MM-DD hh:mm:ss A');
            const deliveryFee = order.deliveryFee;
            const totalAmount = + order.totalAmount + deliveryFee;

            const currencyFormatter = new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                minimumFractionDigits: 0,
            });
    
            const formattedOrder = {
                
                orderId: order._id,
                customerFullName: order.userId.fullName,
                customerProfileImage: order.userId.profileImage,
               sellerFullName: order.products[0]?.sellerId?.firstName + ' ' + order.products[0]?.sellerId?.lastName || '',
                products: order.products.map(product => ({
                    productId: product.productId._id,
                    productName: product.productId.productName,
                    productImage: product.productId.images,
                    productAmount:currencyFormatter.format(product.totalPrice),
                })),
                deliveryAddress: order.deliveryAddress,
                phoneNumber: order.phoneNumber,
                orderStatus: order.orderStatus,
                orderDate: formattedOrderDate,
                deliveryFee: currencyFormatter.format(deliveryFee),
                totalAmount: currencyFormatter.format(totalAmount),
            };
    
            return formattedOrder;
    
        } catch (error) {
            console.error('Something went wrong: Service: retrieveOrderById', error);
            throw new Error(error.message);
        }
    }
    
    
}





