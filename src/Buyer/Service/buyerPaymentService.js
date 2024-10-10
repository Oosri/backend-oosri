const axios = require('axios');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const Order = require('../../Buyer/models/buyerOrderModel');

const SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
const BASE_URL = 'https://api.flutterwave.com';

module.exports = {
    InitializeTransaction: async (userId, orderId, amount, currency) => {
        const user = await mongoDbDataFormat.getUserById(userId);

        if (!user || !user.email) {
            throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
        }

        const url = `${BASE_URL}/v3/payments`;
        const data = {
            tx_ref: orderId, 
            amount, 
            currency: currency || "NGN",
            redirect_url: 'https://yourapp.com/confirmation',
            customer: {
                email: user.email,
                name: user.fullName,
                phone_number: user. phoneNumber
            }
        };

        try {
            const response = await axios.post(url, data, {
                headers: {
                    'Authorization': `Bearer ${SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            return { 
                success: true, 
                data: response.data
            };
        } catch (error) {
            throw error.response ? error.response.data : new Error('Transaction initialization failed');
        }
    },



    verifyPayment: async (orderId) => {
        const order = await Order.findOne({ orderId });
        if (!order) {
            throw new Error(constants.buyerOrderMessage.ORDER_NOT_FOUND);
        }
    
        const url = `${BASE_URL}/v3/transactions/${orderId}/verify`;
    
        try {
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
            });
    
            const paymentData = response.data.data;
    
            if (response.data.status && paymentData.status === 'successful') {
                order.paymentStatus = 'Paid';
                order.orderStatus = 'Processing';
                await order.save();  
    
                return {
                    success: true,
                    payment_status: true,
                    amount: paymentData.amount / 100, 
                    request_status: paymentData.status,
                    reference: orderId,
                };
            } else {
                return {
                    success: false,
                    payment_status: false,
                    amount: paymentData.amount / 100,
                    request_status: paymentData.status,
                    reference: orderId,
                };
            }
        } catch (error) {
            throw error.response ? error.response.data : new Error('Payment verification failed.');
        }
    }
    
    }
    


