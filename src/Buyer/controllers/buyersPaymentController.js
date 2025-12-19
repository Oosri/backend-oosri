const { createPaymentIntent } = require("../Service/paymentService");
const Payment = require("../models/paymentModel");
const Order = require("../models/buyerOrderModel");
const { Product } = require("../../models/productModel");
const mongoose = require("mongoose");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { validateStockAvailability } = require("../../utils/paymentUtils");
const { getFxRateNGNtoUSD } = require("../Service/fxService");
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '15');
/**
 * Create Payment Intent for Multi-Vendor Cart with Stock Validation
 */
module.exports.createMultiVendorPaymentIntent = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const { buyerId, currency, sellers } = req.body;

        console.log("Starting createMultiVendorPaymentIntent");
        console.log("Request body:", JSON.stringify(req.body, null, 2));

        // Validation
        if (!buyerId || !sellers || !Array.isArray(sellers) || sellers.length === 0) {
            console.log("Validation failed: Missing buyerId or sellers");
            return res.status(400).json({
                error: "buyerId and sellers array are required"
            });
        }

        // Validate stock availability before creating payment intent
        console.log("Validating stock...");
        const stockIssues = await validateStockAvailability(sellers);
        console.log("Stock validation result:", JSON.stringify(stockIssues));

        //Validate stock availability
        if (stockIssues.length > 0) {
            return res.status(400).json({
                error: "Stock validation failed",
                stockIssues
            });
        }

        //Fetch FX rate (NGN -> USD)
        const fxRate = await getFxRateNGNtoUSD();

        let totalAmountCents = 0;
        const sellerAmounts = [];

        for (const sellerData of sellers) {
            let sellerBaseAmountNGN = 0;
            for (const item of sellerData.items) {
                const product = await Product.findById(item.productId);
                if (!product) throw new Error(`Product not found: ${item.productId}`);
                const unitPriceNGN = product.salesPrice > 0 ? product.salesPrice : product.regularPrice;
                sellerBaseAmountNGN += unitPriceNGN * item.quantity;
            }

            // Calculate USD amount using the fetched fxRate
            const sellerAmountUSD = Number((sellerBaseAmountNGN * fxRate).toFixed(2));

            sellerData.baseAmountNGN = sellerBaseAmountNGN;
            sellerData.verifiedAmount = sellerAmountUSD;
            sellerData.fxRate = fxRate;

            totalAmountCents += Math.round(sellerAmountUSD * 100);
            sellerAmounts.push({
                ...sellerData,
            });
        }

        console.log("Total amount calculated:", totalAmountCents / 100);

        if (totalAmountCents <= 0) {
            return res.status(400).json({ error: "Total amount must be greater than 0" });
        }

        console.log("Starting transaction...");
        await session.startTransaction();
        console.log("Transaction started");

        // Create one Stripe Payment Intent for the entire cart
        console.log("Creating Stripe Payment Intent...");
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmountCents,
            currency: 'usd',
            metadata: {
                buyerId,
                fxRate,
                baseCurrency: 'NGN'
            }

        });
        console.log("Payment Intent created:", paymentIntent.id);

        // Create individual payment records for each seller
        const paymentRecords = [];

        for (const sellerData of sellers) {
            const { sellerId, baseAmountNGN, items, shippingAddress, verifiedAmount } = sellerData;

            // Calculate fees for this seller
            const grossAmountCents = Math.round(verifiedAmount * 100);
            const platformFeeCents = Math.round(grossAmountCents * (PLATFORM_FEE_PERCENT / 100));
            const sellerAmountCents = grossAmountCents - platformFeeCents;

            // Create payment record for this seller
            const payment = await Payment.create([{
                order_id: null,
                stripe_payment_intent_id: paymentIntent.id,
                buyer_id: buyerId,
                seller_id: sellerId,
                gross_amount_cents: grossAmountCents,
                seller_amount_cents: sellerAmountCents,
                platform_fee_cents: platformFeeCents,
                currency: "USD",
                base_amount: baseAmountNGN,
                base_currency: 'NGN',
                fx_rate: fxRate,
                status: "pending",
                raw: paymentIntent,
                // Store complete order data including product details for inventory deduction
                pending_order_data: {
                    items: items.map(item => ({
                        productId: item.productId,
                        name: item.name,
                        quantity: item.quantity,
                        priceNGN: item.price,
                        image: item.image,
                        // Store current stock for verification
                        stockAtOrderTime: null // Will be set during order creation
                    })),
                    shippingAddress,
                    sellerId,
                    buyerId
                }
            }], { session });

            paymentRecords.push({
                paymentId: payment[0]._id,
                sellerId,
                amountUSD: verifiedAmount,
            });
        }

        await session.commitTransaction();

        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            totalAmountUSD: totalAmountCents,
            fxRate,
            payments: paymentRecords
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Multi-Vendor Payment Intent Error:", error);
        res.status(500).json({
            error: "Internal Server Error",
            message: error.message
        });
    } finally {
        session.endSession();
    }
};

/**
 * Enhanced Webhook Handler for Multi-Vendor Payments
 */
module.exports.handleStripeWebhook = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const sig = req.headers['stripe-signature'];
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        const paymentIntent = event.data.object;

        await session.startTransaction();

        // Find all payment records for this payment intent (multi-vendor)
        const payments = await Payment.find({
            stripe_payment_intent_id: paymentIntent.id
        }).session(session);

        if (!payments || payments.length === 0) {
            await session.abortTransaction();
            console.error(`No payments found for intent: ${paymentIntent.id}`);
            return res.status(404).json({ error: "Payments not found" });
        }

        console.log(`Processing ${payments.length} payment(s) for intent: ${paymentIntent.id}`);

        // Handle different Stripe events for ALL payments
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handleMultiVendorPaymentSucceeded(payments, paymentIntent, session);
                break;

            case 'payment_intent.payment_failed':
                await handleMultiVendorPaymentFailed(payments, paymentIntent, session);
                break;

            case 'payment_intent.canceled':
                await handleMultiVendorPaymentCanceled(payments, paymentIntent, session);
                break;

            case 'charge.refunded':
                await handleMultiVendorRefund(payments, event.data.object, session);
                break;

            case 'charge.dispute.created':
                await handleMultiVendorDispute(payments, event.data.object, session);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        await session.commitTransaction();
        res.json({ received: true });

    } catch (error) {
        await session.abortTransaction();
        console.error("Webhook Error:", error);
        res.status(500).json({ error: "Webhook handler failed" });
    } finally {
        session.endSession();
    }
};

/**
 * Handle successful multi-vendor payment with ATOMIC inventory deduction
 */
async function handleMultiVendorPaymentSucceeded(payments, paymentIntent, session) {
    console.log(`Multi-vendor payment succeeded: ${paymentIntent.id}`);

    const inventoryDeductions = [];
    const ordersCreated = [];

    try {
        // Process each seller's payment
        for (const payment of payments) {
            // Skip if already processed (idempotency)
            if (payment.status === "succeeded" && payment.order_id) {
                console.log(`Payment already processed: ${payment._id}`);
                continue;
            }

            // Update payment status
            payment.status = "succeeded";
            payment.raw = paymentIntent;
            await payment.save({ session });

            // Create order and deduct inventory atomically
            if (!payment.order_id && payment.pending_order_data) {
                const orderData = payment.pending_order_data;

                // Validate and deduct inventory for each item
                for (const item of orderData.items) {
                    const product = await Product.findById(item.productId).session(session);

                    if (!product) {
                        throw new Error(`Product not found: ${item.productId} (${item.name})`);
                    }

                    // Check stock availability at order creation time
                    if (product.inStock < item.quantity) {
                        throw new Error(
                            `Insufficient stock for ${product.productName}. ` +
                            `Requested: ${item.quantity}, Available: ${product.inStock}`
                        );
                    }

                    // Check if product is still available for sale
                    if (product.productStatus !== 'approved' || !product.isVisible) {
                        throw new Error(
                            `Product ${product.productName} is no longer available for purchase`
                        );
                    }

                    const updateResult = await Product.findOneAndUpdate(
                        {
                            _id: product._id,
                            inStock: { $gte: item.quantity } // Ensure stock is still sufficient
                        },
                        {
                            $inc: { inStock: -item.quantity }
                        },
                        {
                            new: true,
                            session
                        }
                    );

                    if (!updateResult) {
                        throw new Error(
                            `Failed to deduct inventory for ${product.productName}. ` +
                            `Stock may have been depleted by another order.`
                        );
                    }

                    // Track deduction for potential rollback
                    inventoryDeductions.push({
                        productId: product._id,
                        productName: product.productName,
                        quantityDeducted: item.quantity,
                        previousStock: product.inStock,
                        newStock: updateResult.inStock
                    });

                    // Update item with final stock info
                    item.stockAtOrderTime = product.inStock;
                    item.stockAfterOrder = updateResult.inStock;

                    console.log(
                        `Inventory deducted: ${product.productName} | ` +
                        `Qty: ${item.quantity} | ` +
                        `Stock: ${product.inStock} → ${updateResult.inStock}`
                    );

                    // Check for low stock and alert seller
                    // const { checkAndAlertLowStock } = require('../helpers/inventoryHelpers');
                    // setImmediate(() => {
                    //     checkAndAlertLowStock(product._id, payment.seller_id).catch(err => {
                    //         console.error('Failed to check low stock:', err);
                    //     });
                    // });
                }

                // Create order with updated item info
                const order = await Order.create([{
                    userId: payment.buyer_id,
                    sellerId: payment.seller_id,
                    items: orderData.items,
                    shippingAddress: [orderData.shippingAddress],
                    paymentStatus: "paid",
                    orderStatus: "processing",
                    totalAmount: payment.gross_amount_cents / 100,
                    platformFee: payment.platform_fee_cents / 100,
                    sellerAmount: payment.seller_amount_cents / 100,
                    paymentMethod: "card",
                    paymentIntentId: paymentIntent.id,
                    orderDate: new Date(),
                    inventoryDeducted: true,
                    inventoryDeductionLog: inventoryDeductions
                }], { session });

                payment.order_id = order[0]._id;
                payment.pending_order_data = undefined;
                await payment.save({ session });

                ordersCreated.push(order[0]);

                console.log(
                    `Order created for seller ${payment.seller_id}: ${order[0]._id}`
                );

                // Send notification to seller (async, non-blocking)
                setImmediate(() => {
                    //Notify seller
                    notifySeller(payment.seller_id, order[0], payment).catch(err => {
                        console.error('Failed to notify seller:', err);
                    });
                });
            }
        }

        // Send consolidated confirmation to buyer
        if (ordersCreated.length > 0) {
            setImmediate(() => {
                notifyBuyer(payments[0].buyer_id, payments, ordersCreated).catch(err => {
                    console.error('Failed to notify buyer:', err);
                });
            });
        }

        console.log(
            `All orders processed successfully. ` +
            `Orders: ${ordersCreated.length}, ` +
            `Inventory deductions: ${inventoryDeductions.length}`
        );

    } catch (error) {
        console.error('Error during order creation:', error);

        // Payment succeeded but order creation failed
        // We need to refund the customer automatically
        // Mark all payments as failed
        for (const payment of payments) {
            payment.status = "failed";
            payment.failure_reason = error.message || "Order creation failed - stock depleted";
            await payment.save();
        }

        // Issue automatic refund (async, non-blocking)
        setImmediate(async () => {
            try {
                const refund = await stripe.refunds.create({
                    payment_intent: paymentIntent.id,
                    reason: 'out_of_stock',
                    metadata: {
                        reason: 'Inventory depleted during order processing',
                        original_error: error.message
                    }
                });

                console.log(`Automatic refund issued: ${refund.id} for payment ${paymentIntent.id}`);

                // Notify buyer about the situation
                notifyBuyerOfStockFailure(
                    payments[0].buyer_id,
                    paymentIntent,
                    error.message
                ).catch(err => {
                    console.error('Failed to notify buyer of stock failure:', err);
                });

            } catch (refundError) {
                console.error('Failed to issue automatic refund:', refundError);
                // Alert support team for manual intervention
                alertSupportTeamUrgent(paymentIntent.id, payments, error, refundError);
            }
        });

        // Transaction will be rolled back automatically
        // All inventory deductions will be reverted
        throw error; // Propagate to trigger rollback
    }
}

/**
 * Handle failed multi-vendor payment - NO inventory deduction
 */
async function handleMultiVendorPaymentFailed(payments, paymentIntent, session) {
    console.log(`Multi-vendor payment failed: ${paymentIntent.id}`);

    for (const payment of payments) {
        payment.status = "failed";
        payment.failure_reason = paymentIntent.last_payment_error?.message || "Payment failed";
        payment.raw = paymentIntent;
        await payment.save({ session });

        // Cancel order if it exists (edge case)
        if (payment.order_id) {
            const order = await Order.findById(payment.order_id).session(session);
            if (order) {
                order.orderStatus = "canceled";
                order.paymentStatus = "failed";
                await order.save({ session });
            }
        }
    }

    // Notify buyer of failure
    setImmediate(() => {
        notifyBuyerOfFailure(payments[0].buyer_id, paymentIntent).catch(err => {
            console.error('Failed to notify buyer of failure:', err);
        });
    });
}

/**
 * Handle canceled multi-vendor payment
 */
async function handleMultiVendorPaymentCanceled(payments, paymentIntent, session) {
    console.log(`Multi-vendor payment canceled: ${paymentIntent.id}`);

    for (const payment of payments) {
        payment.status = "canceled";
        payment.raw = paymentIntent;
        payment.pending_order_data = undefined;
        await payment.save({ session });

        if (payment.order_id) {
            const order = await Order.findById(payment.order_id).session(session);
            if (order) {
                order.orderStatus = "canceled";
                order.paymentStatus = "canceled";
                await order.save({ session });
            }
        }
    }
}

/**
 * Handle refund - restore inventory atomically
 */
async function handleMultiVendorRefund(payments, charge, session) {
    console.log(`Multi-vendor refund: ${charge.id}`);

    const totalRefunded = charge.amount_refunded;
    const totalAmount = payments.reduce((sum, p) => sum + p.gross_amount_cents, 0);

    for (const payment of payments) {
        // Calculate proportional refund
        const refundAmount = Math.round((payment.gross_amount_cents / totalAmount) * totalRefunded);

        payment.status = "refunded";
        payment.refund_amount_cents = refundAmount;
        payment.raw = charge;
        await payment.save({ session });

        if (payment.order_id) {
            const order = await Order.findById(payment.order_id).session(session);
            if (order) {
                // Restore inventory for refunded items
                if (order.inventoryDeducted && order.items) {
                    for (const item of order.items) {
                        await Product.findByIdAndUpdate(
                            item.productId,
                            {
                                $inc: { inStock: item.quantity }
                            },
                            { session }
                        );

                        console.log(
                            `Inventory restored: ${item.name} | Qty: +${item.quantity}`
                        );
                    }
                }

                order.orderStatus = "canceled";
                order.paymentStatus = "refunded";
                order.refundAmount = refundAmount / 100;
                order.inventoryRestored = true;
                order.inventoryRestoredAt = new Date();
                await order.save({ session });

                // Notify seller of refund
                setImmediate(() => {
                    notifySellerOfRefund(payment.seller_id, order, refundAmount / 100).catch(err => {
                        console.error('Failed to notify seller of refund:', err);
                    });
                });
            }
        }
    }
}

/**
 * Handle dispute - all orders go on hold, NO inventory changes
 */
async function handleMultiVendorDispute(payments, dispute, session) {
    console.log(`Multi-vendor dispute: ${dispute.id}`);

    for (const payment of payments) {
        payment.status = "disputed";
        payment.dispute_id = dispute.id;
        payment.dispute_reason = dispute.reason;
        payment.raw = dispute;
        await payment.save({ session });

        if (payment.order_id) {
            const order = await Order.findById(payment.order_id).session(session);
            if (order) {
                order.orderStatus = "on-hold";
                order.paymentStatus = "disputed";
                await order.save({ session });
            }
        }
    }

    // Alert support team
    setImmediate(() => {
        alertSupportTeam(dispute, payments).catch(err => {
            console.error('Failed to alert support team:', err);
        });
    });
}

// Notification helpers - implemented with email service
const emailService = require('../../utils/emailService');
const Buyer = require('../models/buyerAuthModel');
const Seller = require('../../models/sellerModel');

async function notifySeller(sellerId, order, payment) {
    console.log(`📧 Notifying seller ${sellerId} of new order ${order._id}`);

    try {
        // Fetch seller details
        const seller = await Seller.findById(sellerId);
        if (!seller) {
            console.error(`Seller not found: ${sellerId}`);
            return;
        }

        // Fetch buyer details for the order
        const buyer = await Buyer.findById(order.userId);
        const buyerName = buyer ? buyer.fullName : 'Customer';

        // Format items list
        const itemsList = order.items.map(item =>
            `<p>• ${item.name} - Quantity: ${item.quantity} - ₦${item.priceNGN}</p>`
        ).join('');

        const sellerName = `${seller.firstName} ${seller.lastName}`;
        const totalAmount = (payment.gross_amount_cents / 100).toFixed(2);

        await emailService.sellerOrderNotification(
            seller.email,
            sellerName,
            order._id.toString(),
            buyerName,
            totalAmount,
            itemsList
        );

        console.log(`✅ Seller notification sent to ${seller.email}`);
    } catch (error) {
        console.error('Failed to notify seller:', error);
        // Don't throw - notification failures shouldn't break the payment flow
    }
}

async function notifyBuyer(buyerId, payments, orders) {
    console.log(`📧 Notifying buyer ${buyerId} of successful purchase`);

    try {
        // Fetch buyer details
        const buyer = await Buyer.findById(buyerId);
        if (!buyer) {
            console.error(`Buyer not found: ${buyerId}`);
            return;
        }

        // Calculate total amount
        const totalAmountUSD = payments.reduce((sum, p) => sum + (p.gross_amount_cents / 100), 0).toFixed(2);

        // Format orders list
        const ordersList = orders.map(order => {
            const itemsText = order.items.map(item =>
                `<li>${item.name} x ${item.quantity}</li>`
            ).join('');
            return `
                <div style="margin-bottom: 15px;">
                    <p><strong>Order ID:</strong> ${order._id}</p>
                    <ul>${itemsText}</ul>
                </div>
            `;
        }).join('');

        await emailService.buyerPurchaseConfirmation(
            buyer.email,
            buyer.fullName,
            totalAmountUSD,
            orders.length,
            ordersList
        );

        console.log(`✅ Buyer confirmation sent to ${buyer.email}`);
    } catch (error) {
        console.error('Failed to notify buyer:', error);
    }
}

async function notifyBuyerOfFailure(buyerId, paymentIntent) {
    console.log(`📧 Notifying buyer ${buyerId} of payment failure`);

    try {
        const buyer = await Buyer.findById(buyerId);
        if (!buyer) {
            console.error(`Buyer not found: ${buyerId}`);
            return;
        }

        const failureReason = paymentIntent.last_payment_error?.message || 'Payment could not be processed';

        await emailService.paymentFailureNotification(
            buyer.email,
            buyer.fullName,
            failureReason
        );

        console.log(`✅ Payment failure notification sent to ${buyer.email}`);
    } catch (error) {
        console.error('Failed to notify buyer of failure:', error);
    }
}

async function notifySellerOfRefund(sellerId, order, refundAmount) {
    console.log(`📧 Notifying seller ${sellerId} of refund: $${refundAmount}`);

    try {
        const seller = await Seller.findById(sellerId);
        if (!seller) {
            console.error(`Seller not found: ${sellerId}`);
            return;
        }

        const sellerName = `${seller.firstName} ${seller.lastName}`;

        await emailService.sellerRefundNotification(
            seller.email,
            sellerName,
            order._id.toString(),
            refundAmount.toFixed(2)
        );

        console.log(`✅ Refund notification sent to ${seller.email}`);
    } catch (error) {
        console.error('Failed to notify seller of refund:', error);
    }
}

async function alertSupportTeam(dispute, payments) {
    console.log(`🚨 Alerting support team about dispute ${dispute.id}`);

    try {
        const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_SENDER;
        if (!supportEmail) {
            console.error('Support email not configured');
            return;
        }

        const paymentIds = payments.map(p => p._id.toString()).join(', ');

        await emailService.supportDisputeAlert(
            supportEmail,
            dispute.id,
            dispute.reason || 'Unknown',
            paymentIds
        );

        console.log(`✅ Support team alerted about dispute ${dispute.id}`);
    } catch (error) {
        console.error('Failed to alert support team:', error);
    }
}

async function notifyBuyerOfStockFailure(buyerId, paymentIntent, errorMessage) {
    console.log(`📧 Notifying buyer ${buyerId} of stock depletion and refund`);

    try {
        const buyer = await Buyer.findById(buyerId);
        if (!buyer) {
            console.error(`Buyer not found: ${buyerId}`);
            return;
        }

        await emailService.buyerStockFailureNotification(
            buyer.email,
            buyer.fullName,
            errorMessage
        );

        console.log(`✅ Stock failure notification sent to ${buyer.email}`);
    } catch (error) {
        console.error('Failed to notify buyer of stock failure:', error);
    }
}

async function alertSupportTeamUrgent(paymentIntentId, payments, originalError, refundError) {
    console.log(`🚨🚨 URGENT: Manual refund needed for ${paymentIntentId}`);

    try {
        const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_SENDER;
        if (!supportEmail) {
            console.error('Support email not configured');
            return;
        }

        const buyerId = payments[0]?.buyer_id?.toString() || 'Unknown';
        const totalAmount = payments.reduce((sum, p) => sum + (p.gross_amount_cents / 100), 0).toFixed(2);
        const paymentIds = payments.map(p => p._id.toString()).join(', ');

        await emailService.supportUrgentRefundAlert(
            supportEmail,
            paymentIntentId,
            buyerId,
            totalAmount,
            paymentIds,
            originalError.message || originalError.toString(),
            refundError.message || refundError.toString()
        );

        console.log(`✅ Urgent support alert sent for ${paymentIntentId}`);
    } catch (error) {
        console.error('Failed to send urgent support alert:', error);
    }
}