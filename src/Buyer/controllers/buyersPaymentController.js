const { createPaymentIntent } = require("../Service/paymentService");
const Payment = require("../models/paymentModel");
const Order = require("../models/buyerOrderModel");
const mongoose = require("mongoose");

const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '15');

/**
 * Step 1: Create Payment Intent
 * This endpoint creates a Stripe Payment Intent but does NOT create the order yet
 */
module.exports.createPaymentIntent = async (req, res) => {
    try {
        const { sellerId, buyerId, currency, amount } = req.body;

        // Validate required fields
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: "Invalid amount" });
        }

        if (!sellerId || !buyerId) {
            return res.status(400).json({ error: "Seller ID and Buyer ID are required" });
        }

        // Create Payment Intent (no orderId yet since order doesn't exist)
        const paymentIntent = await createPaymentIntent(
            amount,
            null, // orderId will be set later by webhook
            sellerId,
            buyerId,
            currency
        );

        // Calculate Fees
        const grossAmountCents = paymentIntent.amount;
        const platformFeeCent = Math.round(grossAmountCents * (PLATFORM_FEE_PERCENT / 100));
        const sellerAmountCents = grossAmountCents - platformFeeCent;

        // Create Payment Record (without orderId for now)
        const payment = await Payment.create({
            order_id: null, // Will be updated by webhook after payment confirmation
            stripe_payment_intent_id: paymentIntent.id,
            buyer_id: buyerId,
            gross_amount_cents: grossAmountCents,
            seller_amount_cents: sellerAmountCents,
            platform_fee_cents: platformFeeCent,
            currency,
            seller_id: sellerId,
            status: "pending",
            raw: paymentIntent,
            // Store order data temporarily until webhook confirms payment
            pending_order_data: orderData
        });

        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            paymentId: payment._id,
            paymentIntentId: paymentIntent.id
        });

    } catch (error) {
        console.error("Payment Intent Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Get Payment and Order Status
 * Frontend should poll this endpoint after payment to check if webhook has processed payment
 */
module.exports.getPaymentStatus = async (req, res) => {
    try {
        const { paymentIntentId } = req.params;

        if (!paymentIntentId) {
            return res.status(400).json({ error: "Payment Intent ID is required" });
        }

        const payment = await Payment.findOne({
            stripe_payment_intent_id: paymentIntentId
        }).populate('order_id');

        if (!payment) {
            return res.status(404).json({ error: "Payment not found" });
        }

        // Return comprehensive status
        const response = {
            paymentId: payment._id,
            paymentIntentId: payment.stripe_payment_intent_id,
            status: payment.status,
            orderId: payment.order_id?._id || null,
            orderStatus: payment.order_id?.orderStatus || null,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt
        };

        // Add additional context based on status
        if (payment.status === "failed") {
            response.failureReason = payment.failure_reason;
        }

        if (payment.status === "disputed") {
            response.disputeId = payment.dispute_id;
            response.disputeReason = payment.dispute_reason;
        }

        if (payment.status === "refunded") {
            response.refundAmount = payment.refund_amount_cents / 100;
        }

        res.status(200).json(response);

    } catch (error) {
        console.error("Get Payment Status Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Comprehensive Webhook handler for Stripe events
 */
module.exports.handleStripeWebhook = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const sig = req.headers['stripe-signature'];
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;

        try {
            // Verify webhook signature to ensure it's from Stripe
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        const paymentIntent = event.data.object;

        // Start transaction for all database operations
        await session.startTransaction();

        // Find payment record
        const payment = await Payment.findOne({
            stripe_payment_intent_id: paymentIntent.id
        }).session(session);

        if (!payment) {
            await session.abortTransaction();
            console.error(`Payment not found for intent: ${paymentIntent.id}`);
            return res.status(404).json({ error: "Payment not found" });
        }

        // Handle different Stripe events
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentSucceeded(payment, paymentIntent, session);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentFailed(payment, paymentIntent, session);
                break;

            case 'payment_intent.canceled':
                await handlePaymentCanceled(payment, paymentIntent, session);
                break;

            case 'payment_intent.requires_action':
                await handlePaymentRequiresAction(payment, paymentIntent, session);
                break;

            case 'charge.refunded':
                await handleChargeRefunded(payment, event.data.object, session);
                break;

            case 'charge.dispute.created':
                await handleDisputeCreated(payment, event.data.object, session);
                break;

            case 'payment_intent.processing':
                await handlePaymentProcessing(payment, paymentIntent, session);
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
 * Handle successful payment - CREATE ORDER HERE
 * This is the ONLY place where orders are created after payment
 */
async function handlePaymentSucceeded(payment, paymentIntent, session) {
    console.log(`Payment succeeded: ${paymentIntent.id}`);

    // Update payment status
    payment.status = "succeeded";
    payment.raw = paymentIntent;
    await payment.save({ session });

    // Create order if not already created (idempotency check)
    if (!payment.order_id && payment.pending_order_data) {
        const orderData = payment.pending_order_data;

        const order = await Order.create([{
            ...orderData,
            userId: payment.buyer_id,
            paymentStatus: "paid",
            orderStatus: "processing",
            totalAmount: payment.gross_amount_cents / 100,
            paymentMethod: "card",
            orderDate: new Date()
        }], { session });

        payment.order_id = order[0]._id;
        payment.pending_order_data = undefined; // Clear temporary data
        await payment.save({ session });

        console.log(`Order created: ${order[0]._id} for payment: ${payment._id}`);

        // TODO: Send confirmation email/notification to buyer
        // TODO: Notify seller of new order
    } else if (payment.order_id) {
        console.log(`Order already exists: ${payment.order_id} (idempotent)`);
    }
}

/**
 * Handle failed payment - DO NOT CREATE ORDER
 */
async function handlePaymentFailed(payment, paymentIntent, session) {
    console.log(`Payment failed: ${paymentIntent.id}`);

    payment.status = "failed";
    payment.failure_reason = paymentIntent.last_payment_error?.message || "Payment failed";
    payment.raw = paymentIntent;
    await payment.save({ session });

    // If order was somehow created (edge case), mark it as canceled
    if (payment.order_id) {
        const order = await Order.findById(payment.order_id).session(session);
        if (order) {
            order.orderStatus = "canceled";
            order.paymentStatus = "failed";
            await order.save({ session });
            console.log(`Order ${order._id} marked as canceled due to payment failure`);
        }
    }

    // TODO: Send payment failure notification to buyer
    // TODO: Log failure for analytics/fraud detection
}

/**
 * Handle canceled payment - DO NOT CREATE ORDER
 */
async function handlePaymentCanceled(payment, paymentIntent, session) {
    console.log(`Payment canceled: ${paymentIntent.id}`);

    payment.status = "canceled";
    payment.raw = paymentIntent;
    payment.pending_order_data = undefined; // Clear pending data
    await payment.save({ session });

    // If order exists, cancel it
    if (payment.order_id) {
        const order = await Order.findById(payment.order_id).session(session);
        if (order) {
            order.orderStatus = "canceled";
            order.paymentStatus = "canceled";
            await order.save({ session });
            console.log(`⊘ Order ${order._id} canceled`);
        }
    }

    // TODO: Send cancellation notification to buyer
}

/**
 * Handle payment requiring additional action (3D Secure, etc.)
 */
async function handlePaymentRequiresAction(payment, paymentIntent, session) {
    console.log(`Payment requires action: ${paymentIntent.id}`);

    payment.status = "requires_action";
    payment.raw = paymentIntent;
    await payment.save({ session });

    // TODO: Notify buyer that additional authentication is required
}

/**
 * Handle charge refunded - Update order status
 */
async function handleChargeRefunded(payment, charge, session) {
    console.log(`Charge refunded: ${charge.id}`);

    payment.status = "refunded";
    payment.refund_amount_cents = charge.amount_refunded;
    payment.raw = charge;
    await payment.save({ session });

    // Update order if it exists
    if (payment.order_id) {
        const order = await Order.findById(payment.order_id).session(session);
        if (order) {
            order.orderStatus = "canceled";
            order.paymentStatus = "refunded";
            await order.save({ session });
            console.log(`Order ${order._id} marked as refunded`);

            // TODO: Handle inventory restoration
            // TODO: Notify buyer and seller of refund
            // TODO: Update seller payout records
        }
    }
}

/**
 * Handle dispute created - Flag order and payment
 */
async function handleDisputeCreated(payment, dispute, session) {
    console.log(`⚖ Dispute created: ${dispute.id}`);

    payment.status = "disputed";
    payment.dispute_id = dispute.id;
    payment.dispute_reason = dispute.reason;
    payment.raw = dispute;
    await payment.save({ session });

    // Flag order if it exists
    if (payment.order_id) {
        const order = await Order.findById(payment.order_id).session(session);
        if (order) {
            order.orderStatus = "on-hold";
            order.paymentStatus = "disputed";
            await order.save({ session });
            console.log(`Order ${order._id} placed on hold due to dispute`);

            // TODO: Alert support team about dispute
            // TODO: Pause fulfillment if order hasn't shipped
            // TODO: Prepare evidence for dispute resolution
        }
    }
}

/**
 * Handle payment processing - Update status
 */
async function handlePaymentProcessing(payment, paymentIntent, session) {
    console.log(`Payment processing: ${paymentIntent.id}`);

    payment.status = "processing";
    payment.raw = paymentIntent;
    await payment.save({ session });

    // TODO: Optional: Update UI to show processing state
}