const Order = require('../../Buyer/models/buyerOrderModel');
const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const moment = require('moment');
const constants = require('../constants');




module.exports ={
    createOrder: async (serviceData) => {
        try {
            const productIds = serviceData.items.map(item => item.productId);
    
            const validProducts = await Product.find({ '_id': { $in: productIds } });
            if (validProducts.length !== productIds.length) {
                throw new Error('One or more product IDs are invalid');
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
                    totalPrice: productTotal  
                };
            });
    
            serviceData.products = productsData; 
            serviceData.totalAmount = totalAmount; 
            serviceData.totalUniqueProducts = uniqueProducts.size; 
            serviceData.userId = serviceData.userId;
    
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
    
            return formattedOrder;  
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
                    select: 'productName price images'
                })
                .skip(skip)
                .limit(limit);
    
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
    }
    
      
}



// module.exports.retrieveAllOrders = async ({ skip = 0, limit = 10 }) => {
//   try {
//     let orders = await Order.find({})
//       .skip(parseInt(skip))
//       .limit(parseInt(limit))
//       .populate({
//         path: 'products.productId',
//         select: 'productName price'
//       });

//     let formattedOrders = orders.map(order => {
//       let totalAmount = 0;
//       order.products = order.products.map(product => {
//         const totalPrice = product.productId.price * product.quantity;
//         totalAmount += totalPrice;
//         return {
//           productId: product.productId._id,
//           productName: product.productId.productName,
//           quantity: product.quantity,
//           totalPrice
//         };
//       });
//       order.totalAmount = totalAmount;
//       return order.toObject();
//     });

//     return formattedOrders;
//   } catch (error) {
//     console.log('Something went wrong: Service: retrieveAllOrders', error);
//     throw new Error(error.message);
//   }
// };



// module.exports.updateExistingOrder = async ({ id, updateInfo }) => {
//   try {
//     mongoDbDataFormat.checkObjectId(id);
//     let order = await Order.findOneAndUpdate(
//       { _id: id },
//       updateInfo,
//       { new: true }
//     ).populate('products.productId', 'productName price');

//     if (!order) {
//       throw new Error(constants.orderMessage.ORDER_NOT_FOUND);
//     }

//     let totalAmount = 0;
//     order.products = order.products.map(product => {
//       const totalPrice = product.productId.price * product.quantity;
//       totalAmount += totalPrice;
//       return {
//         productId: product.productId._id,
//         productName: product.productId.productName,
//         quantity: product.quantity,
//         totalPrice
//       };
//     });
//     order.totalAmount = totalAmount;

//     return order.toObject();
//   } catch (error) {
//     console.log('Something went wrong: Service: updateOrder', error);
//     throw new Error(error.message);
//   }
// };

// module.exports.removeOrder = async ({ id }) => {
//   try {
//     mongoDbDataFormat.checkObjectId(id);
//     let order = await Order.findByIdAndDelete(id).populate({
//       path: 'products.productId',
//       select: 'productName price'
//     });

//     if (!order) {
//       throw new Error(constants.orderMessage.ORDER_NOT_FOUND);
//     }

//     let totalAmount = 0;
//     order.products = order.products.map(product => {
//       const totalPrice = product.productId.price * product.quantity;
//       totalAmount += totalPrice;
//       return {
//         productId: product.productId._id,
//         productName: product.productId.productName,
//         quantity: product.quantity,
//         totalPrice
//       };
//     });
//     order.totalAmount = totalAmount;

//     return order.toObject();
//   } catch (error) {
//     console.log('Something went wrong: Service: removeOrder', error);
//     throw new Error(error.message);
//   }
// };
