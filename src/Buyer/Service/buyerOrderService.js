const Order = require('../../Buyer/models/buyerOrderModel');
const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const moment = require('moment');
const constants = require('../constants');
const sendEmail = require('../../utils/emailService');
const Buyer = require('../../Buyer/models/buyerAuthModel')




module.exports ={
    createOrder: async (serviceData) => {
        try {
            const productIds = serviceData.items.map(item => item.productId);
    
            const validProducts = await Product.find({ '_id': { $in: productIds } });
            if (validProducts.length !== productIds.length) {
                throw new Error(constants.buyerProductMessage.INVALID_PRODUCT_ID);
            }
    
            let totalAmount = 0;
            const uniqueProducts = new Set();
    
            const productsData = serviceData.items.map(item => {
                const productData = validProducts.find(p => p._id.toString() === item.productId);
                if (!productData) {
                    throw new Error(`Product with ID ${item.productId} not found`);
                }
    
                const productTotal = productData.price * item.quantity;  
                totalAmount += productTotal;  
                uniqueProducts.add(productData._id.toString());  
    
                return {
                    productId: productData._id,  
                    productName: productData.productName,  
                    images: productData.images,  
                    price: productData.price,  
                    quantity: item.quantity, 
                    totalPrice: productTotal,
                    sellerId: productData.seller._id 
                };
            });
    
            serviceData.products = productsData; 
            serviceData.totalAmount = totalAmount; 
            serviceData.totalUniqueProducts = uniqueProducts.size; 
            serviceData.userId = serviceData.userId;


            const user = await Buyer.findById(serviceData.userId).select('email fullName');
            if (!user) {
                throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
            }
    
            serviceData.userEmail = user.email;  
            serviceData.fullName = user.fullName;

    
            if (serviceData.paymentMethod === 'pod') { 
                serviceData.paymentStatus = 'pay on delivery';
            } else {
                serviceData.paymentStatus = 'pending payment';
            }
            const newOrder = new Order({ ...serviceData });
            const result = await newOrder.save();  

    
            let savedOrder = await Order.findById(result._id)
                .populate({
                    path: 'products.productId',
                    select: 'productName price images'  
                });
    
            let formattedOrder = mongoDbDataFormat.formatMongoData(savedOrder);
            formattedOrder.totalAmount = totalAmount; 
            formattedOrder.totalUniqueProducts = uniqueProducts.size; 
            const deliveryFee = savedOrder.deliveryFee || 0;
            const grandTotalAmount = totalAmount + deliveryFee;
            const currencyFormatter = new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                minimumFractionDigits: 0,
            });

            const allImages = productsData.flatMap(product => product.images);
            const randomImages = allImages.sort(() => 0.5 - Math.random()).slice(0, 3);

    
            await sendEmail.orderPlaced(serviceData.userEmail, result._id, serviceData.fullName, randomImages);

            return {
                orderId: result._id,  
                deliveryFee: currencyFormatter.format(deliveryFee),  
                totalAmount: currencyFormatter.format(grandTotalAmount)
            };
    
        } catch (error) {
            console.error('Something went wrong: Service: createOrder', error);
            throw new Error(error.message);
        }
    },

    retrieveBuyerOrders: async (userId, { skip = 0, limit = 10 }) => {
        try {
            mongoDbDataFormat.checkObjectId(userId);
            skip = parseInt(skip) || 0;
            limit = parseInt(limit) || 10;
    
            let orders = await Order.find({ userId })
                .populate({
                    path: 'products.productId',
                    select: 'productName price images seller',
                    populate: { 
                        path: 'seller', 
                        select: 'firstName lastName' 
                    }
                })
                .skip(skip)
                .limit(limit);

                if(!orders || orders.length === 0){
                    return [];
                }
    
            const currencyFormatter = new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                minimumFractionDigits: 0,
            });
    
            let formattedOrders = orders.map(order => {
                const subtotal = order.products.reduce((acc, product) => {
                    const productData = product.productId || {};
                    return acc + (productData.price * product.quantity);
                }, 0);
    
                const deliveryFee = order.deliveryFee || 0;  
                const grandTotal = order.totalAmount + deliveryFee;
    
                const formattedOrderDate = moment(order.orderDate).format('YYYY-MM-DD hh:mm:ss A');
    
                return {
                    orderId: order._id, 
                    totalAmount: currencyFormatter.format(order.totalAmount),
                    subtotal: currencyFormatter.format(subtotal),
                    deliveryFee: currencyFormatter.format(deliveryFee),  
                    grandTotal: currencyFormatter.format(grandTotal),  
                    orderDate: formattedOrderDate,
                    deliveryAddress: order.deliveryAddress,
                    orderStatus: order.orderStatus,
                    landMark: order.landMark || '',
                    products: order.products.map(product => {
                        const productData = product.productId || {};
                        return {
                            productName: productData.productName || 'Unknown Product',
                            sellerName: productData.seller ? `${productData.seller.firstName} ${productData.seller.lastName}` : 'Unknown Seller', 
                            images: productData.images || [],
                           
                        };
                    })
                };
            });
    
            return formattedOrders;
        } catch (error) {
            console.log('Something went wrong: Service: retrieveBuyerOrders', error);
            throw new Error(error.message);
        }
    },
    


    buyerCancelOrder : async (orderId, userId) => {
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
                const deliveryFee = order.deliveryFee;
                const totalAmount = + order.totalAmount + deliveryFee;
                return {
                    orderId: order._id,
                    customerFullName: order.userId.fullName || '',  
                    totalAmount: currencyFormatter.format(totalAmount),
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





