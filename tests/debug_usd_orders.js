
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Order = require('../src/Buyer/models/buyerOrderModel');
const buyerOrderService = require('../src/Buyer/Service/buyerOrderService');

async function verifyUSD() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        // Find a buyer with orders
        const order = await Order.findOne({}).populate('userId');
        if (!order) {
            console.log('No orders found to verify.');
            return;
        }

        const userId = order.userId._id;
        console.log(`Verifying orders for user: ${userId}`);

        const response = await buyerOrderService.retrieveBuyerOrders(userId, { limit: 1 });

        if (response.orders && response.orders.length > 0) {
            const testOrder = response.orders[0];
            console.log('\n--- Order Verification ---');
            console.log(`Order ID: ${testOrder.orderId}`);
            console.log(`Total (NGN): ${testOrder.totalAmount}`);
            console.log(`Total (USD): ${testOrder.totalAmountUSD}`);
            console.log(`Subtotal (NGN): ${testOrder.subtotal}`);
            console.log(`Subtotal (USD): ${testOrder.subtotalUSD}`);
            console.log(`Delivery Fee (NGN): ${testOrder.deliveryFee}`);
            console.log(`Delivery Fee (USD): ${testOrder.deliveryFeeUSD}`);
            console.log(`Exchange Rate: ${testOrder.fxRate}`);

            if (testOrder.totalAmountUSD !== null && testOrder.fxRate > 0) {
                console.log('\n✅ USD fields are populated!');
            } else {
                console.log('\n❌ USD fields are missing or FX rate is 0.');
            }
        }

        // Verify single order
        console.log('\n--- Single Order Verification ---');
        const singleOrder = await buyerOrderService.retrieveOrderById(order._id);
        console.log(`Order ID: ${singleOrder.orderId}`);
        console.log(`Total (USD): ${singleOrder.totalAmountUSD}`);
        console.log(`Delivery Fee (USD): ${singleOrder.deliveryFeeUSD}`);

    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

verifyUSD();
