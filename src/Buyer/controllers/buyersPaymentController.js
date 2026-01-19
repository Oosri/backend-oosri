const { createPaymentIntent } = require("../Service/paymentService");
const Payment = require("../models/paymentModel");
const Order = require("../models/buyerOrderModel");
const Buyer = require("../models/buyerAuthModel");
const { Product } = require("../../models/productModel");
const mongoose = require("mongoose");
const stripe = require('stripe')(process.env.STRIPE_PAYMENT_TEST_KEY);
const { validateStockAvailability } = require("../../utils/paymentUtils");
const { getFxRateNGNtoUSD } = require("../Service/fxService");
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '15');
const SellerLedger = require("../../models/sellerLedger");
const StripeEvent = require("../../models/stripeEventModel");
const { validateAddress } = require("../Service/buyerDHLService");
const { calculateConsolidatedShipping } = require("../Service/buyerShippingService");

// Notification helpers - implemented with email service
const { addEmailJob } = require('../../queues/email.queue');
const Seller = require('../../models/sellerModel');

/**
 * Create Payment Intent for Multi-Vendor Cart with Stock Validation
 */
module.exports.createMultiVendorPaymentIntent = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        let { buyerId, currency, sellers, items, deliveryAddress, addressId } = req.body;

        console.log("Starting createMultiVendorPaymentIntent");
        console.log("Request body:", JSON.stringify(req.body, null, 2));

        // Validation: Must have either sellers (old way) or items (new way)
        const hasSellers = sellers && Array.isArray(sellers) && sellers.length > 0;
        const hasItems = items && Array.isArray(items) && items.length > 0;

        if (!buyerId || (!hasSellers && !hasItems)) {
            console.log("Validation failed: Missing buyerId, sellers, or items");
            return res.status(400).json({
                error: "buyerId and either sellers or items array are required"
            });
        }

        if (!addressId) {
            return res.status(400).json({
                error: "addressId is required to fetch official delivery details from buyer profile"
            });
        }

        console.log(`Verifying delivery address from profile using ID: ${addressId}`);
        const buyer = await Buyer.findOne({ _id: buyerId, 'deliveryAddresses._id': addressId });

        if (!buyer) {
            return res.status(404).json({ error: "Buyer profile not found or address not authorized" });
        }

        const savedAddress = buyer.deliveryAddresses.id(addressId);
        if (!savedAddress) {
            return res.status(404).json({ error: "Delivery address not found in buyer profile" });
        }

        // Materialize the verified delivery address from the database (Source of Truth)
        deliveryAddress = {
            address: savedAddress.address,
            postalCode: savedAddress.postalCode,
            cityName: savedAddress.cityName,
            countryCode: savedAddress.countryCode,
            countryName: savedAddress.countryName
        };

        if (!deliveryAddress.countryCode || !deliveryAddress.cityName || !deliveryAddress.postalCode) {
            console.log("Validation failed: Saved address is incomplete in DB");
            return res.status(400).json({
                error: "Saved delivery address is missing required DHL fields (countryCode, cityName, postalCode)"
            });
        }

        // DHL Address Verification 
        console.log("Verifying delivery address with DHL...");
        try {
            await validateAddress({
                countryCode: deliveryAddress.countryCode,
                cityName: deliveryAddress.cityName,
                postalCode: deliveryAddress.postalCode
            });
        } catch (addrError) {
            const isServiceError = addrError.message.includes('timeout') ||
                addrError.message.includes('500') ||
                addrError.message.includes('503') ||
                addrError.message.includes('ECONNREFUSED');

            if (isServiceError) {
                console.warn(`[RESILLIENCE] DHL Service unavailable: ${addrError.message}. Proceeding with payment.`);
                // We allow it to proceed because we don't want to block sales due to external downtime
            } else {
                console.error("DHL Address validation failed:", addrError.message);
                return res.status(400).json({
                    error: "Delivery address validation failed",
                    message: addrError.message
                });
            }
        }

        // Step 1: Normalize items into grouped sellers if only items provided
        // This moves the "heavy lifting" to the backend as requested
        let normalizedSellers = sellers;
        let fetchedProducts = [];

        if (hasItems && !hasSellers) {
            console.log("Normalizing flat items array into vendor groups...");
            const productIds = items.map(i => i.productId);
            fetchedProducts = await Product.find({ _id: { $in: productIds } }).lean();

            // Group by seller
            const groups = {};
            for (const item of items) {
                const product = fetchedProducts.find(p => p._id.toString() === item.productId);
                if (!product) {
                    return res.status(404).json({ error: `Product not found: ${item.productId}` });
                }

                const sellerId = product.seller.toString();
                if (!groups[sellerId]) {
                    groups[sellerId] = { sellerId, items: [] };
                }
                groups[sellerId].items.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    name: product.productName, // Enrich here
                    price: product.salesPrice > 0 ? product.salesPrice : product.regularPrice,
                    image: product.images && product.images.length > 0 ? product.images[0] : null
                });
            }
            normalizedSellers = Object.values(groups);
        } else {
            // For backward compatibility: still validate stock and fetch products if using old sellers format
            // but we'll collect IDs to fetch them efficiently
            const productIds = sellers.flatMap(s => s.items.map(i => i.productId));
            fetchedProducts = await Product.find({ _id: { $in: productIds } }).lean();
        }

        // Validate stock availability using normalized array
        console.log("Validating stock...");
        const stockIssues = await validateStockAvailability(normalizedSellers);
        console.log("Stock validation result:", JSON.stringify(stockIssues));

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

        for (const sellerData of normalizedSellers) {
            let sellerBaseAmountNGN = 0;
            for (const item of sellerData.items) {
                const product = fetchedProducts.find(p => p._id.toString() === item.productId);
                if (!product) throw new Error(`Product not found: ${item.productId}`);

                // DB is source of truth for price
                const unitPriceNGN = product.salesPrice > 0 ? product.salesPrice : product.regularPrice;
                sellerBaseAmountNGN += unitPriceNGN * item.quantity;

                // Ensure items are enriched with DB data
                item.name = product.productName;
                item.price = unitPriceNGN;
                item.image = product.images && product.images.length > 0 ? product.images[0] : null;
            }

            // Calculate USD amount in cents directly to avoid floating point issues
            // Formula: NGN * (USD/NGN) * 100
            const sellerAmountCents = Math.round(sellerBaseAmountNGN * fxRate * 100);
            const sellerAmountUSD = sellerAmountCents / 100;

            sellerData.baseAmountNGN = sellerBaseAmountNGN;
            sellerData.verifiedAmount = sellerAmountUSD; // for display/legacy
            sellerData.verifiedAmountCents = sellerAmountCents;
            sellerData.fxRate = fxRate;

            totalAmountCents += sellerAmountCents;
            sellerAmounts.push({
                ...sellerData,
            });
        }

        console.log("Total product amount calculated:", totalAmountCents / 100);

        if (totalAmountCents <= 0) {
            return res.status(400).json({ error: "Total amount must be greater than 0" });
        }

        // Calculate consolidated shipping fee for all items
        console.log("Calculating shipping fee...");
        const productTotalCents = totalAmountCents;
        let shippingFeeCents = 0;
        let shippingDetails = null;

        try {
            shippingDetails = await calculateConsolidatedShipping(
                deliveryAddress,
                normalizedSellers,
                fetchedProducts
            );

            shippingFeeCents = Math.round(shippingDetails.totalPriceUSD * 100);
            console.log(`Shipping fee calculated: $${shippingDetails.totalPriceUSD} (${shippingDetails.cached ? 'CACHED' : 'LIVE'})`);

            // Add shipping to total
            totalAmountCents = productTotalCents + shippingFeeCents;
            console.log(`Total amount with shipping: $${totalAmountCents / 100} (Products: $${productTotalCents / 100} + Shipping: $${shippingFeeCents / 100})`);

        } catch (shippingError) {
            console.error("Shipping calculation failed:", shippingError.message);

            // RESILIENCE: If shipping calculation fails and no cache is available, fail the payment
            // This ensures pricing accuracy and prevents undercharging
            return res.status(503).json({
                error: "Unable to calculate shipping fee",
                message: "Shipping service is temporarily unavailable. Please try again in a few moments.",
                details: shippingError.message
            });
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
                baseCurrency: 'NGN',
                productTotalCents,
                shippingFeeCents,
                shippingProvider: shippingDetails?.provider || 'DHL',
                shippingCached: shippingDetails?.cached ? 'true' : 'false',
                deliveryAddress: JSON.stringify(deliveryAddress)
            }

        });
        console.log("Payment Intent created:", paymentIntent.id);

        // Create individual payment records for each seller
        const paymentRecords = [];

        for (const sellerData of normalizedSellers) {
            const { sellerId, baseAmountNGN, items, verifiedAmountCents } = sellerData;

            // Calculate fees for this seller using cents
            const grossAmountCents = verifiedAmountCents;
            const platformFeeCents = Math.round(grossAmountCents * (PLATFORM_FEE_PERCENT / 100));
            const sellerNetAmountCents = grossAmountCents - platformFeeCents;

            // Create payment record for this seller
            const payment = await Payment.create([{
                order_id: null,
                stripe_payment_intent_id: paymentIntent.id,
                buyer_id: buyerId,
                seller_id: sellerId,
                gross_amount_cents: grossAmountCents,
                seller_amount_cents: sellerNetAmountCents,
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
                    sellerId,
                    buyerId,
                    deliveryAddress // Store the verified delivery address
                }
            }], { session });

            paymentRecords.push({
                type: 'product',
                paymentId: payment[0]._id,
                sellerId: sellerId,
                amount: {
                    cents: grossAmountCents,
                    dollars: grossAmountCents / 100
                }
            });
        }

        // 7. Payment Reconciliation: Create a record for the shipping fee (Platform Hub)
        if (shippingFeeCents > 0) {
            console.log("Creating platform record for shipping/handling fee...");
            const shippingPayment = await Payment.create([{
                stripe_payment_intent_id: paymentIntent.id,
                buyer_id: buyerId,
                seller_id: null, // Platform Hub
                gross_amount_cents: shippingFeeCents,
                seller_amount_cents: 0,
                platform_fee_cents: shippingFeeCents,
                currency: "USD",
                status: "pending",
                raw: {
                    description: "Consolidated Shipping & Hub Handling Fee ($1.5 inclusive)",
                    shippingDetails
                },
                pending_order_data: {
                    type: "shipping_fee",
                    shippingProvider: shippingDetails?.provider,
                    deliveryAddress
                }
            }], { session });

            paymentRecords.push({
                type: 'shipping',
                paymentId: shippingPayment[0]._id,
                sellerId: null,
                amount: {
                    cents: shippingFeeCents,
                    dollars: shippingFeeCents / 100
                }
            });
        }

        await session.commitTransaction();

        res.status(200).json({
            summary: {
                productTotal: {
                    cents: productTotalCents,
                    dollars: Number((productTotalCents / 100).toFixed(2))
                },
                shippingFee: {
                    cents: shippingFeeCents,
                    dollars: Number((shippingFeeCents / 100).toFixed(2))
                },
                totalAmount: {
                    cents: totalAmountCents,
                    dollars: Number((totalAmountCents / 100).toFixed(2))
                }
            },
            payments: paymentRecords,
            shippingDetails: {
                provider: shippingDetails?.provider,
                productName: shippingDetails?.productName,
                estimatedDeliveryDate: shippingDetails?.estimatedDeliveryDate,
                cached: shippingDetails?.cached || false
            },
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            fxRate
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
            event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        const eventObj = event.data.object;

        // Extract the Payment Intent ID correctly regardless of event type
        // For charge.* and dispute.* events, the PI ID is in the 'payment_intent' field
        const paymentIntentId = eventObj.object === 'payment_intent' ? eventObj.id : eventObj.payment_intent;

        console.log(paymentIntentId, "PROCESSING STRIPE EVENT:", event.type);

        await session.startTransaction();

        // 1. Idempotency Check: Check if this event has already been processed
        const existingEvent = await StripeEvent.findOne({ eventId: event.id }).session(session);
        if (existingEvent) {
            console.log(`Event ${event.id} already processed. Skipping.`);
            await session.commitTransaction();
            return res.json({ received: true, duplicate: true });
        }

        // 2. Record the event as being processed
        await StripeEvent.create([{
            eventId: event.id,
            type: event.type,
            status: 'processed'
        }], { session });

        // Find all payment records for this payment intent (multi-vendor)
        const payments = await Payment.find({
            stripe_payment_intent_id: paymentIntentId
        }).session(session);

        if (!payments || payments.length === 0) {
            // If no payments found, return 200 OK to stop Stripe retries.
            // This happens for events we don't track or if the PI was created outside this flow.
            await session.commitTransaction();
            console.log(`No matching payment records found for intent: ${paymentIntentId}. Skipping.`);
            return res.json({ received: true, message: "No matching payment records found" });
        }

        console.log(`Processing ${payments.length} payment(s) for intent: ${paymentIntentId}`);

        // Handle different Stripe events for ALL payments
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handleMultiVendorPaymentSucceeded(payments, eventObj, session);
                break;

            case 'payment_intent.payment_failed':
                await handleMultiVendorPaymentFailed(payments, eventObj, session);
                break;

            case 'payment_intent.canceled':
                await handleMultiVendorPaymentCanceled(payments, eventObj, session);
                break;

            case 'charge.refunded':
                await handleMultiVendorRefund(payments, eventObj, session);
                break;

            case 'charge.dispute.created':
                await handleMultiVendorDispute(payments, eventObj, session);
                break;

            case 'charge.dispute.closed':
                await handleMultiVendorDisputeClosed(payments, eventObj, session);
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

            // Ported from webhook.js: Fetch actual Stripe fee from balance transaction
            const charge = paymentIntent.charges?.data?.[0];
            if (charge) {
                payment.stripe_charge_id = charge.id;
                if (charge.balance_transaction) {
                    try {
                        const balanceTransaction = await stripe.balanceTransactions.retrieve(charge.balance_transaction);
                        payment.stripe_fee_cents = balanceTransaction.fee;
                    } catch (feeError) {
                        console.error(`Failed to retrieve Stripe fee for ${charge.id}:`, feeError.message);
                    }
                }
            }

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
                            $inc: {
                                inStock: -item.quantity,
                                total_sales: item.quantity // Increment total_sales by units sold
                            }
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
                    // Map items to products to match Order schema
                    products: orderData.items.map(item => ({
                        productId: item.productId,
                        productName: item.name,
                        price: item.priceNGN,
                        images: item.image ? [item.image] : [],
                        quantity: item.quantity,
                        totalPrice: item.priceNGN * item.quantity,
                        sellerId: payment.seller_id
                    })),
                    // items: orderData.items, // REMOVED: Schema uses 'products'
                    deliveryAddresses: [orderData.deliveryAddress],
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

                // Create Seller Ledger Entry with running balance
                const lastLedgerEntry = await SellerLedger.findOne({ seller_id: payment.seller_id })
                    .sort({ createdAt: -1 })
                    .session(session);

                const previousBalance = lastLedgerEntry ? lastLedgerEntry.balance_after_cents : 0;
                const newBalance = previousBalance + payment.seller_amount_cents;

                await SellerLedger.create([{
                    seller_id: payment.seller_id,
                    payment_id: payment._id,
                    credit_usd_cents: payment.seller_amount_cents,
                    balance_after_cents: newBalance,
                }], { session });

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

                // Add debit entry to Seller Ledger
                const lastLedgerEntry = await SellerLedger.findOne({ seller_id: payment.seller_id })
                    .sort({ createdAt: -1 })
                    .session(session);

                const previousBalance = lastLedgerEntry ? lastLedgerEntry.balance_after_cents : 0;
                // We debit the proportional amount that was actually paid to the seller
                // (refundAmount - platform fee portion)
                const platformFeeRefund = Math.round(refundAmount * (PLATFORM_FEE_PERCENT / 100));
                const sellerDebitCents = refundAmount - platformFeeRefund;
                const newBalance = previousBalance - sellerDebitCents;

                await SellerLedger.create([{
                    seller_id: payment.seller_id,
                    payment_id: payment._id,
                    debit_usd_cents: sellerDebitCents,
                    balance_after_cents: newBalance,
                }], { session });

                // Ported from webhook.js: Freeze seller on negative balance
                if (newBalance < 0) {
                    await Seller.findByIdAndUpdate(payment.seller_id, { is_frozen: true }).session(session);
                    console.log(`Seller ${payment.seller_id} frozen due to negative balance: ${newBalance}`);
                }

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

        // Ported from webhook.js: Freeze seller immediately on dispute
        await Seller.findByIdAndUpdate(payment.seller_id, { is_frozen: true }).session(session);
        console.log(`Seller ${payment.seller_id} frozen due to dispute: ${dispute.id}`);

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

/**
 * Handle closed dispute - credit seller back if won
 */
async function handleMultiVendorDisputeClosed(payments, dispute, session) {
    console.log(`Multi-vendor dispute closed: ${dispute.id}, status: ${dispute.status}`);

    if (dispute.status === 'won') {
        for (const payment of payments) {
            payment.status = "succeeded";
            payment.raw = dispute;
            await payment.save({ session });

            // Ported from webhook.js: Unfreeze seller
            await Seller.findByIdAndUpdate(payment.seller_id, { is_frozen: false }).session(session);

            const creditAmount = dispute.amount;
            const lastLedger = await SellerLedger.findOne({ seller_id: payment.seller_id })
                .sort({ createdAt: -1 })
                .session(session);

            const prevBalance = lastLedger ? lastLedger.balance_after_cents : 0;
            const newBalance = prevBalance + creditAmount;

            await SellerLedger.create([{
                seller_id: payment.seller_id,
                payment_id: payment._id,
                credit_usd_cents: creditAmount,
                balance_after_cents: newBalance
            }], { session });

            console.log(`Dispute won for PI ${payment.stripe_payment_intent_id}. Credited seller ${payment.seller_id}.`);
        }
    }
}



async function notifySeller(sellerId, order, payment) {
    console.log(`📧 Notifying seller ${sellerId} of new order ${order._id}`);

    try {
        // Fetch seller details
        const seller = await Seller.findById(sellerId);
        if (!seller) {
            console.error(`Seller not found: ${sellerId}`);
            return;
        }

        // Calculate NGN breakdown
        const grossAmountNGN = payment.base_amount || 0;
        const platformFeeNGN = grossAmountNGN * (PLATFORM_FEE_PERCENT / 100);
        const netAmountNGN = grossAmountNGN - platformFeeNGN;

        await addEmailJob('seller-order', {
            sellerId,
            orderId: order._id.toString(),
            buyerId: order.userId,
            grossAmountNGN: grossAmountNGN.toLocaleString(),
            items: orderItems.map(item => ({
                productName: item.productName || item.name,
                quantity: item.quantity,
                price: (item.price || item.priceNGN).toLocaleString()
            })),
            netAmountNGN: netAmountNGN.toLocaleString(),
            platformFeeNGN: platformFeeNGN.toLocaleString()
        });

        console.log(`✅ Seller notification enqueued for ${seller.email}`);
    } catch (error) {
        console.error('Failed to enqueue seller notification:', error);
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

        await addEmailJob('buyer-confirmation', {
            buyerId,
            totalAmountUSD,
            orderCount: orders.length,
            orders: orders.map(order => ({
                orderId: order._id,
                items: (order.products || order.items || []).map(item => {
                    const fxRate = payments.find(p => p.seller_id.toString() === item.sellerId.toString())?.fx_rate || 1;
                    return {
                        name: item.productName || item.name,
                        quantity: item.quantity,
                        priceUSD: ((item.price || 0) * fxRate).toFixed(2)
                    };
                })
            }))
        });

        console.log(`✅ Buyer confirmation enqueued for ${buyer.email}`);
    } catch (error) {
        console.error('Failed to enqueue buyer notification:', error);
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

        await addEmailJob('payment-failure', {
            buyerId,
            failureReason
        });

        console.log(`✅ Payment failure notification enqueued for ${buyer.email}`);
    } catch (error) {
        console.error('Failed to enqueue buyer failure notification:', error);
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

        await addEmailJob('seller-refund', {
            sellerId,
            orderId: order._id.toString(),
            refundAmount: refundAmount.toFixed(2)
        });

        console.log(`✅ Refund notification enqueued for ${seller.email}`);
    } catch (error) {
        console.error('Failed to enqueue seller refund notification:', error);
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

        await addEmailJob('support-dispute', {
            supportEmail,
            disputeId: dispute.id,
            reason: dispute.reason || 'Unknown',
            paymentIds
        });

        console.log(`✅ Support team dispute alert enqueued`);
    } catch (error) {
        console.error('Failed to enqueue support dispute alert:', error);
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

        await addEmailJob('buyer-stock-failure', {
            buyerId,
            errorMessage
        });

        console.log(`✅ Stock failure notification enqueued for ${buyer.email}`);
    } catch (error) {
        console.error('Failed to enqueue buyer stock failure notification:', error);
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

        await addEmailJob('support-urgent-refund', {
            supportEmail,
            paymentIntentId,
            buyerId,
            totalAmount,
            paymentIds,
            originalError: originalError.message || originalError.toString(),
            refundError: refundError.message || refundError.toString()
        });

        console.log(`✅ Urgent support alert enqueued for ${paymentIntentId}`);
    } catch (error) {
        console.error('Failed to enqueue urgent support alert:', error);
    }
}