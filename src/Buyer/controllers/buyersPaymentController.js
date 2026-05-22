const { createPaymentIntent } = require("../Service/paymentService");
const Payment = require("../models/paymentModel");
const Order = require("../models/buyerOrderModel");
const Buyer = require("../models/buyerAuthModel");
const CheckoutSession = require("../models/checkoutSessionModel");
const { Product } = require("../../models/productModel");
const mongoose = require("mongoose");
const crypto = require("crypto");
const stripe = require('stripe')(process.env.STRIPE_PAYMENT_TEST_KEY);
const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);
const { validateStockAvailability } = require("../../utils/paymentUtils");
const { getFxRateNGNtoUSD } = require("../Service/adminControlledFxService");
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '15');
const SellerLedger = require("../../models/sellerLedger");
const StripeEvent = require("../../models/stripeEventModel");
const { calculateConsolidatedShipping } = require("../Service/buyerShippingService");
const shippingProviderService = require("../Service/shippingProviderService");
const { processOrdersLogistics } = require("../Service/orderLogisticsService");

// Notification helpers - implemented with email service
const { addEmailJob } = require('../../queues/email.queue');
const Seller = require('../../models/sellerModel');

function getBuyerFrontendUrl() {
    return (
        process.env.BUYER_FRONTEND_URL ||
        process.env.FRONTEND_URL ||
        process.env.APP_FRONTEND_URL ||
        'http://localhost:3000'
    ).replace(/\/$/, '');
}

function allocateShippingFeeCents(totalShippingFeeCents, sellerAmounts) {
    if (!totalShippingFeeCents || totalShippingFeeCents <= 0 || !sellerAmounts.length) {
        return new Map();
    }

    const totalProductCents = sellerAmounts.reduce(
        (sum, sellerData) => sum + (sellerData.verifiedAmountCents || 0),
        0
    );

    if (totalProductCents <= 0) {
        return new Map();
    }

    const allocations = sellerAmounts.map((sellerData) => {
        const exactShare = (totalShippingFeeCents * sellerData.verifiedAmountCents) / totalProductCents;
        const roundedDownShare = Math.floor(exactShare);

        return {
            sellerId: sellerData.sellerId?.toString(),
            cents: roundedDownShare,
            remainder: exactShare - roundedDownShare,
        };
    });

    let allocatedCents = allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
    let remainingCents = totalShippingFeeCents - allocatedCents;

    allocations.sort((left, right) => {
        if (right.remainder !== left.remainder) {
            return right.remainder - left.remainder;
        }

        return right.cents - left.cents;
    });

    let allocationIndex = 0;
    while (remainingCents > 0 && allocations.length > 0) {
        allocations[allocationIndex].cents += 1;
        remainingCents -= 1;
        allocationIndex = (allocationIndex + 1) % allocations.length;
    }

    return new Map(allocations.map((allocation) => [allocation.sellerId, allocation.cents]));
}

module.exports.__testables = {
    allocateShippingFeeCents,
};

const ACTIVE_CHECKOUT_TTL_MS = 30 * 60 * 1000;

function buildCheckoutRequestHash({
    buyerId,
    currency,
    addressId,
    serviceType,
    sellers,
}) {
    const normalizedSellers = (sellers || [])
        .map((seller) => ({
            sellerId: seller.sellerId?.toString(),
            items: (seller.items || [])
                .map((item) => ({
                    productId: item.productId?.toString(),
                    quantity: item.quantity,
                    price: item.price,
                }))
                .sort((left, right) =>
                    left.productId.localeCompare(right.productId)
                ),
        }))
        .sort((left, right) => left.sellerId.localeCompare(right.sellerId));

    return crypto
        .createHash("sha256")
        .update(
            JSON.stringify({
                buyerId: buyerId?.toString(),
                currency: currency || "usd",
                addressId: addressId?.toString(),
                serviceType: serviceType || "default",
                sellers: normalizedSellers,
            })
        )
        .digest("hex");
}

async function adjustSellerBalance({
    session,
    sellerId,
    paymentId,
    creditCents = 0,
    debitCents = 0,
    setFrozen = null,
}) {
    const balanceDelta = (creditCents || 0) - (debitCents || 0);
    const update = {};

    if (balanceDelta !== 0) {
        update.$inc = { available_balance_cents: balanceDelta };
    }

    if (typeof setFrozen === "boolean") {
        update.$set = { is_frozen: setFrozen };
    }

    const seller = await Seller.findOneAndUpdate(
        { _id: sellerId },
        update,
        {
            new: true,
            session,
        }
    );

    if (!seller) {
        // Seller document missing — log and skip. Order creation must not be aborted
        // because of a missing seller balance record (reconcilable later).
        console.warn(`Seller not found for balance update: ${sellerId}. Balance update skipped.`);
        return null;
    }

    await SellerLedger.create([{
        seller_id: sellerId,
        payment_id: paymentId,
        credit_usd_cents: creditCents,
        debit_usd_cents: debitCents,
        balance_after_cents: seller.available_balance_cents || 0,
    }], { session });

    return seller;
}

async function updateCheckoutSessionStatus(paymentIntentId, status, session) {
    if (!paymentIntentId) {
        return;
    }

    await CheckoutSession.updateMany(
        { stripe_payment_intent_id: paymentIntentId },
        {
            $set: {
                status,
                expires_at: new Date(),
            }
        },
        session ? { session } : undefined
    );
}

async function updatePaystackCheckoutSessionStatus(reference, status, session) {
    if (!reference) {
        return;
    }

    await CheckoutSession.updateMany(
        { paystack_reference: reference },
        {
            $set: {
                status,
                expires_at: new Date(),
            }
        },
        session ? { session } : undefined
    );
}

async function schedulePaymentRecovery({
    eventId,
    eventType,
    paymentIntentId,
    buyerId,
    payments,
    originalErrorMessage
}) {
    const recoveryAttemptedAt = new Date();

    await StripeEvent.findOneAndUpdate(
        { eventId },
        {
            $set: {
                type: eventType,
                status: 'recovery_scheduled',
                processedAt: recoveryAttemptedAt
            }
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        }
    );

    await Payment.updateMany(
        { stripe_payment_intent_id: paymentIntentId },
        {
            $set: {
                recovery_required: true,
                recovery_state: 'pending_refund',
                recovery_last_error: originalErrorMessage,
                recovery_attempted_at: recoveryAttemptedAt
            }
        }
    );
    await updateCheckoutSessionStatus(paymentIntentId, 'expired');

    try {
        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            metadata: {
                reason: 'Order creation failed after payment success',
                original_error: originalErrorMessage
            }
        });

        await Payment.updateMany(
            { stripe_payment_intent_id: paymentIntentId },
            {
                $set: {
                    recovery_required: true,
                    recovery_state: 'refund_initiated',
                    recovery_refund_id: refund.id,
                    recovery_last_error: originalErrorMessage,
                    recovery_attempted_at: new Date()
                }
            }
        );

        console.info(`Automatic refund issued: ${refund.id} for payment ${paymentIntentId}`);

        notifyBuyerOfStockFailure(
            buyerId,
            { id: paymentIntentId },
            originalErrorMessage
        ).catch((err) => {
            console.error('Failed to notify buyer of stock failure:', err);
        });
    } catch (refundError) {
        await Payment.updateMany(
            { stripe_payment_intent_id: paymentIntentId },
            {
                $set: {
                    recovery_required: true,
                    recovery_state: 'manual_intervention',
                    recovery_last_error: `${originalErrorMessage} | Refund failed: ${refundError.message || refundError.toString()}`,
                    recovery_attempted_at: new Date()
                }
            }
        );

        console.error('Failed to issue automatic refund:', refundError);
        alertSupportTeamUrgent(
            paymentIntentId,
            payments,
            new Error(originalErrorMessage),
            refundError
        );
    }
}

/**
 * Create Payment Intent for Multi-Vendor Cart with Stock Validation
 */
module.exports.createMultiVendorPaymentIntent = async (req, res) => {
    const session = await mongoose.startSession();
    let checkoutRequestHash = null;
    let buyerId;

    try {
        let { buyerId: requestBuyerId, currency, sellers, items, deliveryAddress, addressId, serviceType } = req.body;
        const authenticatedBuyerId = req.user?.id?.toString?.() || null;

        if (authenticatedBuyerId && requestBuyerId && authenticatedBuyerId !== requestBuyerId.toString()) {
            return res.status(403).json({
                error: "Unauthorized buyer context"
            });
        }

        buyerId = authenticatedBuyerId || requestBuyerId;

        // Validation: Must have either sellers (old way) or items (new way)
        const hasSellers = sellers && Array.isArray(sellers) && sellers.length > 0;
        const hasItems = items && Array.isArray(items) && items.length > 0;

        if (!buyerId || (!hasSellers && !hasItems)) {
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
                error: "Saved delivery address is missing required shipping fields (countryCode, cityName, postalCode)"
            });
        }

        const selectedShippingProvider = shippingProviderService.getDefaultShippingProviderForAddress(deliveryAddress);

        // Provider-aware address verification
        console.log(`Verifying delivery address with ${selectedShippingProvider}...`);
        try {
            await shippingProviderService.validateAddress({
                provider: selectedShippingProvider,
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
                console.warn(`[RESILLIENCE] ${selectedShippingProvider} service unavailable: ${addrError.message}. Proceeding with payment.`);
                // We allow it to proceed because we don't want to block sales due to external downtime
            } else {
                console.error(`${selectedShippingProvider} address validation failed:`, addrError.message);
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
        const stockIssues = await validateStockAvailability(normalizedSellers);

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

        checkoutRequestHash = buildCheckoutRequestHash({
            buyerId,
            currency,
            addressId,
            serviceType,
            sellers: sellerAmounts,
        });

        const existingCheckoutSession = await CheckoutSession.findOne({
            buyer_id: buyerId,
            request_hash: checkoutRequestHash,
            status: 'active',
            expires_at: { $gt: new Date() }
        }).lean();

        if (existingCheckoutSession?.response_payload) {
            const existingPayments = await Payment.find({
                stripe_payment_intent_id: existingCheckoutSession.stripe_payment_intent_id
            }).select('status order_id').lean();

            const canReuseExistingCheckout = existingPayments.length > 0 &&
                existingPayments.every((payment) =>
                    ['pending', 'requires_action'].includes(payment.status) && !payment.order_id
                );

            if (canReuseExistingCheckout) {
                return res.status(200).json({
                    ...existingCheckoutSession.response_payload,
                    reused: true
                });
            }

            await CheckoutSession.updateOne(
                { _id: existingCheckoutSession._id },
                { $set: { status: 'expired' } }
            );
        }

        if (totalAmountCents <= 0) {
            return res.status(400).json({ error: "Total amount must be greater than 0" });
        }

        // Calculate consolidated shipping fee for all items
        const productTotalCents = totalAmountCents;
        let shippingFeeCents = 0;
        let shippingDetails = null;

        try {
            shippingDetails = await calculateConsolidatedShipping(
                deliveryAddress,
                normalizedSellers,
                fetchedProducts,
                { selectedServiceType: serviceType }
            );

            shippingFeeCents = Math.round(shippingDetails.totalPriceUSD * 100);

            // Add shipping to total
            totalAmountCents = productTotalCents + shippingFeeCents;

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

        const shippingAllocations = allocateShippingFeeCents(shippingFeeCents, sellerAmounts);

        await session.startTransaction();

        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmountCents,
            currency: 'usd',
            metadata: {
                buyerId,
                fxRate,
                baseCurrency: 'NGN',
                productTotalCents,
                shippingFeeCents,
                shippingProvider: shippingDetails?.provider || selectedShippingProvider,
                shippingServiceName: shippingDetails?.selectedServiceName || shippingDetails?.productName || shippingDetails?.product || '',
                shippingServiceCode: shippingDetails?.selectedServiceType || shippingDetails?.productCode || '',
                shippingEstimatedDeliveryDate: shippingDetails?.estimatedDeliveryDate || '',
                shippingCached: shippingDetails?.cached ? 'true' : 'false',
                deliveryAddress: JSON.stringify(deliveryAddress)
            }

        }, {
            idempotencyKey: `checkout:${checkoutRequestHash}`
        });
        // Create individual payment records for each seller
        const paymentRecords = [];

        for (const sellerData of sellerAmounts) {
            const { sellerId, baseAmountNGN, items, verifiedAmountCents } = sellerData;
            const allocatedShippingFeeCents = shippingAllocations.get(sellerId?.toString()) || 0;

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
                        stockAtOrderTime: null
                    })),
                    sellerId,
                    buyerId,
                    deliveryAddress, // Store the verified delivery address
                    shippingFeeCents,
                    allocatedShippingFeeCents,
                    shippingProvider: shippingDetails?.provider || selectedShippingProvider,
                    shippingServiceName: shippingDetails?.selectedServiceName || shippingDetails?.productName || shippingDetails?.product || '',
                    shippingServiceCode: shippingDetails?.selectedServiceType || shippingDetails?.productCode || '',
                    estimatedDeliveryDate: shippingDetails?.estimatedDeliveryDate || null
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
                    shippingProvider: shippingDetails?.provider || selectedShippingProvider,
                    shippingServiceName: shippingDetails?.selectedServiceName || shippingDetails?.productName || shippingDetails?.product || '',
                    shippingServiceCode: shippingDetails?.selectedServiceType || shippingDetails?.productCode || '',
                    estimatedDeliveryDate: shippingDetails?.estimatedDeliveryDate || null,
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

        const responsePayload = {
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
                productName: shippingDetails?.selectedServiceName || shippingDetails?.productName,
                productCode: shippingDetails?.selectedServiceType || shippingDetails?.productCode,
                estimatedDeliveryDate: shippingDetails?.estimatedDeliveryDate,
                cached: shippingDetails?.cached || false
            },
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            fxRate
        };

        await CheckoutSession.create([{
            buyer_id: buyerId,
            request_hash: checkoutRequestHash,
            stripe_payment_intent_id: paymentIntent.id,
            client_secret: paymentIntent.client_secret,
            response_payload: responsePayload,
            expires_at: new Date(Date.now() + ACTIVE_CHECKOUT_TTL_MS),
        }], { session });

        await session.commitTransaction();

        res.status(200).json(responsePayload);

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        if (error?.code === 11000) {
            try {
                const fallbackSession = await CheckoutSession.findOne({
                    buyer_id: buyerId,
                    request_hash: checkoutRequestHash,
                    status: 'active',
                    expires_at: { $gt: new Date() }
                }).lean();

                if (fallbackSession?.response_payload) {
                    return res.status(200).json({
                        ...fallbackSession.response_payload,
                        reused: true
                    });
                }
            } catch (lookupError) {
                console.error("Failed to resolve duplicate checkout session:", lookupError);
            }
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
    let stripeEventId = null;
    let stripeEventType = null;

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
        stripeEventId = event.id;
        stripeEventType = event.type;

        // Extract the Payment Intent ID correctly regardless of event type
        // For charge.* and dispute.* events, the PI ID is in the 'payment_intent' field
        const paymentIntentId = eventObj.object === 'payment_intent' ? eventObj.id : eventObj.payment_intent;

        await session.startTransaction();

        // 1. Idempotency Check: Check if this event has already been processed
        const existingEvent = await StripeEvent.findOne({ eventId: event.id }).session(session);
        if (existingEvent) {
            console.info(`Event ${event.id} already processed. Skipping.`);
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
            console.warn(`No matching payment records found for intent: ${paymentIntentId}. Skipping.`);
            return res.json({ received: true, message: "No matching payment records found" });
        }


        const afterCommitActions = []; // Store actions to run after commit

        // Handle different Stripe events for ALL payments
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handleMultiVendorPaymentSucceeded(payments, eventObj, session, afterCommitActions);
                await updateCheckoutSessionStatus(paymentIntentId, 'completed', session);
                break;

            case 'payment_intent.payment_failed':
                await handleMultiVendorPaymentFailed(payments, eventObj, session, afterCommitActions);
                await updateCheckoutSessionStatus(paymentIntentId, 'expired', session);
                break;

            case 'payment_intent.canceled':
                await handleMultiVendorPaymentCanceled(payments, eventObj, session, afterCommitActions);
                await updateCheckoutSessionStatus(paymentIntentId, 'expired', session);
                break;

            case 'charge.refunded':
                await handleMultiVendorRefund(payments, eventObj, session, afterCommitActions);
                await updateCheckoutSessionStatus(paymentIntentId, 'completed', session);
                break;

            case 'charge.dispute.created':
                await handleMultiVendorDispute(payments, eventObj, session, afterCommitActions);
                break;

            case 'charge.dispute.closed':
                await handleMultiVendorDisputeClosed(payments, eventObj, session, afterCommitActions);
                break;

            default:
                console.warn(`Unhandled Stripe event type: ${event.type}`);
        }

        await session.commitTransaction();

        // Execute post-commit actions (safe notifications)
        for (const action of afterCommitActions) {
            try {
                action();
            } catch (err) {
                console.error('Error executing post-commit action:', err);
            }
        }

        res.json({ received: true });

    } catch (error) {
        await session.abortTransaction();

        if (error.recoveryContext?.paymentIntentId) {
            const recoveryContext = {
                eventId: stripeEventId,
                eventType: stripeEventType,
                ...error.recoveryContext
            };

            setImmediate(() => {
                schedulePaymentRecovery(recoveryContext).catch((recoveryError) => {
                    console.error('Failed to schedule payment recovery:', recoveryError);
                });
            });

            console.error("Webhook recovery scheduled:", error.message);
            return res.json({
                received: true,
                recoveryScheduled: true,
                paymentIntentId: recoveryContext.paymentIntentId
            });
        }

        console.error("Webhook Error:", error);
        res.status(500).json({ error: "Webhook handler failed" });
    } finally {
        session.endSession();
    }
};

module.exports.getPaymentStatus = async (req, res) => {
    try {
        const paymentIntentId = req.params.paymentIntentId;
        const buyerId = req.user?.id;

        if (!paymentIntentId) {
            return res.status(400).json({
                error: 'paymentIntentId is required'
            });
        }

        const payments = await Payment.find({
            stripe_payment_intent_id: paymentIntentId,
            buyer_id: buyerId
        }).lean();

        if (!payments.length) {
            return res.status(404).json({
                error: 'Payment not found'
            });
        }

        const productPayments = payments.filter((payment) => payment.seller_id);
        const orderIds = productPayments
            .map((payment) => payment.order_id)
            .filter(Boolean);

        const orders = orderIds.length
            ? await Order.find({
                _id: { $in: orderIds },
                userId: buyerId
            }).lean()
            : [];

        const hasFailedPayment = payments.some((payment) =>
            ['failed', 'refunded', 'disputed'].includes(payment.status)
        );
        const hasRecoveryIssue = payments.some((payment) =>
            payment.recovery_required ||
            ['pending_refund', 'refund_initiated', 'manual_intervention'].includes(
                payment.recovery_state
            )
        );

        const confirmedOrders = productPayments.filter(
            (payment) => payment.status === 'succeeded' && payment.order_id
        ).length;

        const expectedOrders = productPayments.length;

        let state = 'processing';

        if (hasFailedPayment || hasRecoveryIssue) {
            state = 'failed';
        } else if (expectedOrders > 0 && confirmedOrders === expectedOrders) {
            state = 'confirmed';
        }

        return res.status(200).json({
            success: true,
            state,
            paymentIntentId,
            expectedOrders,
            confirmedOrders,
            orders: orders.map((order) => ({
                id: order._id,
                orderStatus: order.orderStatus,
                paymentStatus: order.paymentStatus,
            }))
        });
    } catch (error) {
        console.error('Payment status retrieval error:', error);
        return res.status(500).json({
            error: 'Failed to retrieve payment status',
            message: error.message
        });
    }
};

/**
 * Handle successful multi-vendor payment with ATOMIC inventory deduction
 */
async function handleMultiVendorPaymentSucceeded(payments, paymentIntent, session, afterCommitActions) {
    console.info(`Multi-vendor payment succeeded: ${paymentIntent.id}`);

    const inventoryDeductions = [];
    const ordersCreated = [];

    try {
        // Process each seller's payment
        for (const payment of payments) {
            // Skip if already processed (idempotency)
            if (payment.status === "succeeded" && payment.order_id) {
                console.info(`Payment already processed: ${payment._id}`);
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
                // FIX: Handle Shipping Fee Payment - Skip inventory deduction
                if (orderData.type === 'shipping_fee') {

                    // We can choose to create a generic "Service Order" here if needed, 
                    // but for now, the Payment record itself serves as the proof of payment for shipping.
                    // The webhook's main job for shipping is just to mark the payment as 'succeeded', which is done above.
                    // Clear pending data to mark as fully processed
                    payment.pending_order_data = undefined;
                    await payment.save({ session });
                    continue;
                }

                // FIX: Defensive check for items to prevent crash
                if (!orderData.items || !Array.isArray(orderData.items)) {
                    console.error(`Invalid order data for payment ${payment._id}: 'items' is missing or not an array.`);
                    // We don't throw here to avoid rolling back valid payments. 
                    // We flag this payment as requiring manual review.
                    payment.status = "requires_action";
                    payment.failure_reason = "Invalid order data: missing items";
                    await payment.save({ session });
                    continue;
                }

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

                    console.info(
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
                const shippingFeeUSD = (orderData.allocatedShippingFeeCents || 0) / 100;
                const orderPayload = {
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
                    deliveryAddresses: [orderData.deliveryAddress],
                    deliveryFee: shippingFeeUSD,
                    shippingProvider: orderData.shippingProvider || paymentIntent.metadata?.shippingProvider || shippingProviderService.getDefaultShippingProvider(),
                    shippingServiceName: orderData.shippingServiceName || paymentIntent.metadata?.shippingServiceName || '',
                    shippingServiceCode: orderData.shippingServiceCode || paymentIntent.metadata?.shippingServiceCode || '',
                    estimatedDeliveryDate: orderData.estimatedDeliveryDate || paymentIntent.metadata?.shippingEstimatedDeliveryDate || null,
                    paymentStatus: "paid",
                    orderStatus: "processing",
                    totalAmount: payment.gross_amount_cents / 100,
                    platformFee: payment.platform_fee_cents / 100,
                    sellerAmount: payment.seller_amount_cents / 100,
                    paymentMethod: "card",
                    paymentIntentId: paymentIntent.id,
                    orderDate: new Date(),
                    inventoryDeducted: true,
                    inventoryDeductionLog: inventoryDeductions,
                    currencyCode: 'USD',
                    baseCurrency: 'NGN'
                };

                const order = await Order.create([orderPayload], { session });

                payment.order_id = order[0]._id;
                payment.pending_order_data = undefined;
                await payment.save({ session });

                await adjustSellerBalance({
                    session,
                    sellerId: payment.seller_id,
                    paymentId: payment._id,
                    creditCents: payment.seller_amount_cents,
                });

                ordersCreated.push(order[0]);

                console.info(
                    `Order created for seller ${payment.seller_id}: ${order[0]._id}`
                );

                // Send notification to seller (async, non-blocking) AFTER commit
                afterCommitActions.push(() => {
                    //Notify seller
                    notifySeller(payment.seller_id, order[0], payment).catch(err => {
                        console.error('Failed to notify seller:', err);
                    });
                });
            }
        }

        // Send consolidated confirmation to buyer AFTER commit
        if (ordersCreated.length > 0) {
            afterCommitActions.push(() => {
                notifyBuyer(payments[0].buyer_id, payments, ordersCreated).catch(err => {
                    console.error('Failed to notify buyer:', err);
                });
            });

            afterCommitActions.push(() => {
                setImmediate(() => {
                    processOrdersLogistics({
                        orderIds: ordersCreated.map((order) => order._id),
                        buyerId: payments[0].buyer_id,
                        paymentIntentId: paymentIntent.id
                    }).catch((err) => {
                        console.error('Failed to process post-order logistics:', {
                            orderIds: ordersCreated.map((order) => order._id.toString()),
                            paymentIntentId: paymentIntent.id,
                            error: err.message
                        });
                    });
                });
            });
        }

        console.info(
            `All orders processed successfully. ` +
            `Orders: ${ordersCreated.length}, ` +
            `Inventory deductions: ${inventoryDeductions.length}`
        );

    } catch (error) {
        console.error('Error during order creation:', error);
        error.recoveryContext = {
            paymentIntentId: paymentIntent.id,
            buyerId: payments[0]?.buyer_id,
            payments: payments.map((payment) => ({
                _id: payment._id,
                buyer_id: payment.buyer_id,
                gross_amount_cents: payment.gross_amount_cents
            })),
            originalErrorMessage:
                error.message || "Order creation failed after successful payment"
        };

        throw error;
    }
}

/**
 * Handle failed multi-vendor payment - NO inventory deduction
 */
async function handleMultiVendorPaymentFailed(payments, paymentIntent, session, afterCommitActions) {
    console.info(`Multi-vendor payment failed: ${paymentIntent.id}`);

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

    // Notify buyer of failure AFTER commit
    afterCommitActions.push(() => {
        notifyBuyerOfFailure(payments[0].buyer_id, paymentIntent).catch(err => {
            console.error('Failed to notify buyer of failure:', err);
        });
    });
}

/**
 * Handle canceled multi-vendor payment
 */
async function handleMultiVendorPaymentCanceled(payments, paymentIntent, session, afterCommitActions) {
    console.info(`Multi-vendor payment canceled: ${paymentIntent.id}`);

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
async function handleMultiVendorRefund(payments, charge, session, afterCommitActions) {
    console.info(`Multi-vendor refund: ${charge.id}`);

    const totalRefunded = charge.amount_refunded;
    const totalAmount = payments.reduce((sum, p) => sum + p.gross_amount_cents, 0);

    for (const payment of payments) {
        // Keep refund handling idempotent across repeated/cumulative charge.refunded events.
        const targetRefundAmount = Math.round(
            (payment.gross_amount_cents / totalAmount) * totalRefunded
        );
        const previousRefundAmount = payment.refund_amount_cents || 0;
        const refundDelta = Math.max(0, targetRefundAmount - previousRefundAmount);
        const isFullyRefundedPayment =
            targetRefundAmount >= payment.gross_amount_cents;

        payment.status = isFullyRefundedPayment ? "refunded" : payment.status;
        payment.refund_amount_cents = targetRefundAmount;
        payment.recovery_required = false;
        payment.recovery_state = isFullyRefundedPayment ? 'refunded' : payment.recovery_state;
        payment.recovery_last_error = undefined;
        payment.recovery_refund_id =
            charge?.refunds?.data?.[0]?.id || payment.recovery_refund_id;
        payment.raw = charge;
        await payment.save({ session });

        if (payment.order_id) {
            const order = await Order.findById(payment.order_id).session(session);
            if (order) {
                // Restore stock only once, and only when the seller-specific payment is fully refunded.
                if (
                    isFullyRefundedPayment &&
                    order.inventoryDeducted &&
                    !order.inventoryRestored &&
                    Array.isArray(order.products) &&
                    order.products.length > 0
                ) {
                    for (const item of order.products) {
                        await Product.findByIdAndUpdate(
                            item.productId,
                            {
                                $inc: { inStock: item.quantity }
                            },
                            { session }
                        );

                        console.info(
                            `Inventory restored: ${item.productName || item.name} | Qty: +${item.quantity}`
                        );
                    }

                    order.inventoryRestored = true;
                    order.inventoryRestoredAt = new Date();
                }

                if (isFullyRefundedPayment) {
                    order.orderStatus = "canceled";
                    order.paymentStatus = "refunded";
                }
                order.refundAmount = targetRefundAmount / 100;
                await order.save({ session });

                if (refundDelta === 0) {
                    continue;
                }

                const platformFeeRefund = Math.round((refundDelta / payment.gross_amount_cents) * payment.platform_fee_cents);
                const sellerDebitCents = refundDelta - platformFeeRefund;
                const updatedSeller = await adjustSellerBalance({
                    session,
                    sellerId: payment.seller_id,
                    paymentId: payment._id,
                    debitCents: sellerDebitCents,
                });

                if (updatedSeller && (updatedSeller.available_balance_cents || 0) < 0 && !updatedSeller.is_frozen) {
                    await Seller.findByIdAndUpdate(
                        payment.seller_id,
                        { $set: { is_frozen: true } },
                        { session }
                    );
                    console.warn(`Seller ${payment.seller_id} frozen due to negative balance: ${updatedSeller.available_balance_cents}`);
                }

                // Notify seller of refund AFTER commit
                afterCommitActions.push(() => {
                    notifySellerOfRefund(payment.seller_id, order, refundDelta / 100).catch(err => {
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
async function handleMultiVendorDispute(payments, dispute, session, afterCommitActions) {
    console.warn(`Multi-vendor dispute opened: ${dispute.id}`);

    for (const payment of payments) {
        payment.status = "disputed";
        payment.dispute_id = dispute.id;
        payment.dispute_reason = dispute.reason;
        payment.raw = dispute;
        await payment.save({ session });

        // Instead of blanket-freezing sellers on any dispute (a DDoS vector from fraudulent buyers),
        // we track dispute metrics. Hard freeze would require manual intervention or higher thresholds.
        // Alerting support is the primary action.
        await Seller.findByIdAndUpdate(payment.seller_id, {
             $inc: { 'disputeCount': 1 }
        }).session(session);
        console.warn(`Dispute registered for Seller ${payment.seller_id}: ${dispute.id}`);

        if (payment.order_id) {
            const order = await Order.findById(payment.order_id).session(session);
            if (order) {
                order.orderStatus = "on-hold";
                order.paymentStatus = "disputed";
                await order.save({ session });
            }
        }
    }

    // Alert support team AFTER commit
    afterCommitActions.push(() => {
        alertSupportTeam(dispute, payments).catch(err => {
            console.error('Failed to alert support team:', err);
        });
    });
}

/**
 * Handle closed dispute - credit seller back if won
 */
async function handleMultiVendorDisputeClosed(payments, dispute, session, afterCommitActions) {
    console.info(`Multi-vendor dispute closed: ${dispute.id}, status: ${dispute.status}`);

    if (dispute.status === 'won') {
        for (const payment of payments) {
            payment.status = "succeeded";
            payment.raw = dispute;
            await payment.save({ session });

            const creditAmount = dispute.amount;
            await adjustSellerBalance({
                session,
                sellerId: payment.seller_id,
                paymentId: payment._id,
                creditCents: creditAmount,
                setFrozen: false,
            });

            console.info(`Dispute won for PI ${payment.stripe_payment_intent_id}. Credited seller ${payment.seller_id}.`);
        }
    }
}



async function notifySeller(sellerId, order, payment) {

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
            items: (order.products || order.items || []).map(item => ({
                productName: item.productName || item.name,
                quantity: item.quantity,
                price: (item.price || item.priceNGN || 0).toLocaleString()
            })),
            netAmountNGN: netAmountNGN.toLocaleString(),
            platformFeeNGN: platformFeeNGN.toLocaleString()
        });

    } catch (error) {
        console.error('Failed to enqueue seller notification:', error);
    }
}

async function notifyBuyer(buyerId, payments, orders) {

    try {
        const buyer = await Buyer.findById(buyerId);
        if (!buyer) {
            console.error(`Buyer not found: ${buyerId}`);
            return;
        }

        // Paystack payments store NGN kobo in gross_amount_cents; Stripe stores USD cents.
        const isNGN = payments.some(p => p.currency === 'NGN' || p.gateway === 'paystack');

        let ngnToUsdRate = null;
        if (isNGN) {
            try {
                ngnToUsdRate = await getFxRateNGNtoUSD();
            } catch (e) {
                console.warn('Failed to fetch FX rate for buyer email:', e.message);
            }
        }

        const totalAmountUSD = payments.reduce((sum, p) => {
            const amountInBase = p.gross_amount_cents / 100;
            return sum + (isNGN && ngnToUsdRate ? amountInBase * ngnToUsdRate : amountInBase);
        }, 0).toFixed(2);

        // Build HTML string — the template substitutes {{ordersList}} directly into the DOM.
        const ordersListHtml = orders.map(order => {
            const itemsHtml = (order.products || order.items || []).map(item => {
                let priceUSD;
                if (isNGN && ngnToUsdRate) {
                    priceUSD = ((item.price || 0) * ngnToUsdRate).toFixed(2);
                } else {
                    const fxRate = payments.find(p => p.seller_id?.toString() === item.sellerId?.toString())?.fx_rate || 1;
                    priceUSD = ((item.price || 0) * fxRate).toFixed(2);
                }
                return `<p>${item.productName || item.name} &times;${item.quantity} &mdash; $${priceUSD}</p>`;
            }).join('');
            return `<p><strong>Order #${order._id.toString().slice(-8).toUpperCase()}</strong></p>${itemsHtml}`;
        }).join('<br/>');

        await addEmailJob('buyer-confirmation', {
            buyerId,
            totalAmountUSD,
            orderCount: orders.length,
            ordersList: ordersListHtml
        });

    } catch (error) {
        console.error('Failed to enqueue buyer notification:', error);
    }
}

async function notifyBuyerOfFailure(buyerId, paymentIntent) {

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

    } catch (error) {
        console.error('Failed to enqueue buyer failure notification:', error);
    }
}

async function notifySellerOfRefund(sellerId, order, refundAmount) {

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

    } catch (error) {
        console.error('Failed to enqueue seller refund notification:', error);
    }
}

async function alertSupportTeam(dispute, payments) {

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

    } catch (error) {
        console.error('Failed to enqueue support dispute alert:', error);
    }
}

async function notifyBuyerOfStockFailure(buyerId, paymentIntent, errorMessage) {

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

    } catch (error) {
        console.error('Failed to enqueue buyer stock failure notification:', error);
    }
}

async function alertSupportTeamUrgent(paymentIntentId, payments, originalError, refundError) {
    console.error(`URGENT: Manual refund needed for ${paymentIntentId}`);

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

        console.info(`Urgent support alert enqueued for ${paymentIntentId}`);
    } catch (error) {
        console.error('Failed to enqueue urgent support alert:', error);
    }
}

// ─── Paystack / Nigerian buyer checkout ───────────────────────────────────────

/**
 * Initialize a Paystack checkout for Nigerian buyers.
 * - Validates the delivery address is within Nigeria (countryCode === 'NG')
 * - Applies the flat ₦2,000 shipping fee
 * - Creates pending Payment records (one per seller, mirroring the Stripe flow)
 * - Returns Paystack authorizationUrl + reference for hosted checkout
 */
module.exports.createPaystackPaymentIntent = async (req, res) => {
    const session = await mongoose.startSession();
    let buyerId;
    let checkoutRequestHash;

    try {
        const authenticatedBuyerId = req.user?.id?.toString() || null;
        const { buyerId: requestBuyerId, addressId, items } = req.body;
        buyerId = authenticatedBuyerId || requestBuyerId;

        if (!buyerId || !addressId || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'buyerId, addressId, and items are required' });
        }

        const buyer = await Buyer.findOne({ _id: buyerId, 'deliveryAddresses._id': addressId });
        if (!buyer) {
            return res.status(404).json({ error: 'Buyer not found or address not authorised' });
        }

        const savedAddress = buyer.deliveryAddresses.id(addressId);
        if (!savedAddress) {
            return res.status(404).json({ error: 'Delivery address not found' });
        }

        if (savedAddress.countryCode !== 'NG') {
            return res.status(400).json({
                error: 'Paystack checkout is only available for Nigerian delivery addresses. Please use Stripe for international orders.'
            });
        }

        const deliveryAddress = {
            address: savedAddress.address,
            postalCode: savedAddress.postalCode,
            cityName: savedAddress.cityName,
            countryCode: savedAddress.countryCode,
            countryName: savedAddress.countryName || 'Nigeria'
        };

        // Fetch and group products by seller
        const productIds = items.map(i => i.productId);
        const fetchedProducts = await Product.find({ _id: { $in: productIds } }).lean();

        const sellerGroups = {};
        for (const item of items) {
            const product = fetchedProducts.find(p => p._id.toString() === item.productId);
            if (!product) {
                return res.status(404).json({ error: `Product not found: ${item.productId}` });
            }
            const sellerId = product.seller.toString();
            if (!sellerGroups[sellerId]) {
                sellerGroups[sellerId] = { sellerId, items: [] };
            }
            sellerGroups[sellerId].items.push({
                productId: item.productId,
                quantity: item.quantity,
                price: product.salesPrice > 0 ? product.salesPrice : product.regularPrice,
                name: product.productName,
                image: product.images?.[0] || null
            });
        }

        const normalizedSellers = Object.values(sellerGroups);

        // Validate stock
        const stockIssues = await validateStockAvailability(normalizedSellers);
        if (stockIssues.length > 0) {
            return res.status(400).json({ error: 'Stock validation failed', stockIssues });
        }

        // Calculate product totals in NGN (Paystack charges NGN directly)
        const FLAT_SHIPPING_NGN = 2000;
        let productTotalNGN = 0;

        for (const sellerData of normalizedSellers) {
            let sellerTotal = 0;
            for (const item of sellerData.items) {
                sellerTotal += item.price * item.quantity;
            }
            sellerData.baseAmountNGN = sellerTotal;
            productTotalNGN += sellerTotal;
        }

        const totalNGN = productTotalNGN + FLAT_SHIPPING_NGN;
        const amountInKobo = Math.round(totalNGN * 100);

        checkoutRequestHash = buildCheckoutRequestHash({
            buyerId,
            currency: 'NGN',
            addressId,
            serviceType: 'NG_FLAT_RATE',
            sellers: normalizedSellers,
        });

        const existingCheckoutSession = await CheckoutSession.findOne({
            buyer_id: buyerId,
            request_hash: checkoutRequestHash,
            status: 'active',
            expires_at: { $gt: new Date() }
        }).lean();

        if (existingCheckoutSession?.response_payload && existingCheckoutSession.paystack_reference) {
            const existingPayments = await Payment.find({
                paystack_reference: existingCheckoutSession.paystack_reference,
                gateway: 'paystack'
            }).select('status order_id').lean();

            const canReuseExistingCheckout = existingPayments.length > 0 &&
                existingPayments.every((payment) =>
                    ['pending', 'requires_action'].includes(payment.status) && !payment.order_id
                );

            if (canReuseExistingCheckout) {
                return res.status(200).json({
                    ...existingCheckoutSession.response_payload,
                    reused: true
                });
            }

            await CheckoutSession.updateOne(
                { _id: existingCheckoutSession._id },
                { $set: { status: 'expired' } }
            );
        }

        // Generate a deterministic reference for idempotency
        const reference = `oosri_ps_${crypto.randomBytes(10).toString('hex')}`;
        const callbackUrl = `${getBuyerFrontendUrl()}/order-confirmation?paystack_reference=${encodeURIComponent(reference)}`;

        // Initialize Paystack transaction
        const transaction = await paystack.transaction.initialize({
            email: buyer.email,
            amount: amountInKobo,
            currency: 'NGN',
            reference,
            callback_url: callbackUrl,
            metadata: {
                buyerId,
                addressId,
                shippingFeeNGN: FLAT_SHIPPING_NGN,
                productTotalNGN,
                totalNGN
            }
        });

        if (!transaction?.data?.authorization_url) {
            throw new Error('Paystack did not return an authorization URL');
        }

        // Create pending Payment records (one per seller + one for shipping)
        await session.startTransaction();

        const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '15');
        const paymentRecords = [];

        for (const sellerData of normalizedSellers) {
            const grossAmountNGN = sellerData.baseAmountNGN;
            const platformFeeNGN = Math.round(grossAmountNGN * (platformFeePercent / 100));
            const sellerNetNGN = grossAmountNGN - platformFeeNGN;

            const payment = await Payment.create([{
                buyer_id: buyerId,
                seller_id: sellerData.sellerId,
                paystack_reference: reference,
                gateway: 'paystack',
                gross_amount_cents: Math.round(grossAmountNGN * 100),
                seller_amount_cents: Math.round(sellerNetNGN * 100),
                platform_fee_cents: Math.round(platformFeeNGN * 100),
                currency: 'NGN',
                base_amount: grossAmountNGN,
                base_currency: 'NGN',
                status: 'pending',
                raw: transaction.data,
                pending_order_data: {
                    items: sellerData.items,
                    sellerId: sellerData.sellerId,
                    buyerId,
                    deliveryAddress,
                    shippingFeeNGN: FLAT_SHIPPING_NGN,
                    shippingProvider: 'FLAT_RATE',
                    shippingServiceName: 'Standard Delivery',
                    shippingServiceCode: 'NG_FLAT_RATE',
                    estimatedDeliveryDate: null
                }
            }], { session });

            paymentRecords.push(payment[0]._id);
        }

        // Platform record for the flat shipping fee
        await Payment.create([{
            buyer_id: buyerId,
            seller_id: null,
            paystack_reference: reference,
            gateway: 'paystack',
            gross_amount_cents: FLAT_SHIPPING_NGN * 100,
            seller_amount_cents: 0,
            platform_fee_cents: FLAT_SHIPPING_NGN * 100,
            currency: 'NGN',
            status: 'pending',
            raw: { description: 'Flat rate shipping fee — Nigeria' },
            pending_order_data: {
                type: 'shipping_fee',
                shippingProvider: 'FLAT_RATE',
                shippingServiceName: 'Standard Delivery',
                deliveryAddress
            }
        }], { session });

        const responsePayload = {
            authorizationUrl: transaction.data.authorization_url,
            reference,
            summary: {
                productTotal: { ngn: productTotalNGN, kobo: Math.round(productTotalNGN * 100) },
                shippingFee: { ngn: FLAT_SHIPPING_NGN, kobo: FLAT_SHIPPING_NGN * 100 },
                total: { ngn: totalNGN, kobo: amountInKobo }
            }
        };

        await CheckoutSession.create([{
            buyer_id: buyerId,
            request_hash: checkoutRequestHash,
            paystack_reference: reference,
            gateway: 'paystack',
            response_payload: responsePayload,
            expires_at: new Date(Date.now() + ACTIVE_CHECKOUT_TTL_MS),
        }], { session });

        await session.commitTransaction();

        return res.status(200).json(responsePayload);

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        if (error?.code === 11000) {
            try {
                const fallbackSession = await CheckoutSession.findOne({
                    buyer_id: buyerId,
                    request_hash: checkoutRequestHash,
                    status: 'active',
                    expires_at: { $gt: new Date() }
                }).lean();

                if (fallbackSession?.response_payload) {
                    return res.status(200).json({
                        ...fallbackSession.response_payload,
                        reused: true
                    });
                }
            } catch (lookupError) {
                console.error('Failed to resolve duplicate Paystack checkout session:', lookupError);
            }
        }
        console.error('Paystack payment intent error:', error);
        return res.status(500).json({ error: 'Failed to initialize payment', message: error.message });
    } finally {
        session.endSession();
    }
};

/**
 * Paystack webhook handler.
 * Verifies HMAC-SHA512 signature, then on charge.success:
 * creates orders and deducts inventory atomically (mirrors Stripe webhook).
 */
module.exports.handlePaystackWebhook = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        // Verify Paystack signature
        const hash = crypto
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
            .update(req.rawBody || JSON.stringify(req.body))
            .digest('hex');

        if (hash !== req.headers['x-paystack-signature']) {
            return res.status(400).json({ error: 'Invalid Paystack webhook signature' });
        }

        const event = req.body;

        if (event.event !== 'charge.success') {
            return res.status(200).json({ received: true, skipped: true });
        }

        const { reference } = event.data;
        if (!reference) {
            return res.status(200).json({ received: true, message: 'No reference found' });
        }

        await session.startTransaction();

        const payments = await Payment.find({
            paystack_reference: reference,
            gateway: 'paystack'
        }).session(session);

        if (!payments.length) {
            await session.commitTransaction();
            return res.status(200).json({ received: true, message: 'No matching payment records' });
        }

        // Idempotency: skip if already processed
        const alreadyProcessed = payments.every(p => p.status === 'succeeded' || p.order_id);
        if (alreadyProcessed) {
            await updatePaystackCheckoutSessionStatus(reference, 'completed', session);
            await session.commitTransaction();
            return res.status(200).json({ received: true, duplicate: true });
        }

        const inventoryDeductions = [];

        for (const payment of payments) {
            if (payment.status === 'succeeded' && payment.order_id) continue;

            payment.status = 'succeeded';
            payment.raw = event.data;
            await payment.save({ session });

            const orderData = payment.pending_order_data;
            if (!orderData || orderData.type === 'shipping_fee') {
                payment.pending_order_data = undefined;
                await payment.save({ session });
                continue;
            }

            if (!Array.isArray(orderData.items)) {
                payment.status = 'requires_action';
                payment.failure_reason = 'Invalid order data: missing items';
                await payment.save({ session });
                continue;
            }

            // Deduct inventory atomically
            for (const item of orderData.items) {
                const product = await Product.findById(item.productId).session(session);
                if (!product) throw new Error(`Product not found: ${item.productId}`);

                if (product.inStock < item.quantity) {
                    throw new Error(`Insufficient stock for ${product.productName}`);
                }

                const updated = await Product.findOneAndUpdate(
                    { _id: product._id, inStock: { $gte: item.quantity } },
                    { $inc: { inStock: -item.quantity, total_sales: item.quantity } },
                    { new: true, session }
                );

                if (!updated) {
                    throw new Error(`Inventory conflict for ${product.productName}`);
                }

                inventoryDeductions.push({
                    productId: product._id,
                    quantityDeducted: item.quantity,
                    previousStock: product.inStock,
                    newStock: updated.inStock
                });

                item.stockAtOrderTime = product.inStock;
                item.stockAfterOrder = updated.inStock;
            }

            // Create order
            const order = await Order.create([{
                userId: payment.buyer_id,
                sellerId: payment.seller_id,
                products: orderData.items.map(item => ({
                    productId: item.productId,
                    productName: item.name,
                    price: item.price,
                    images: item.image ? [item.image] : [],
                    quantity: item.quantity,
                    totalPrice: item.price * item.quantity,
                    sellerId: payment.seller_id
                })),
                deliveryAddresses: [orderData.deliveryAddress],
                deliveryFee: orderData.shippingFeeNGN || 2000,
                shippingProvider: orderData.shippingProvider || 'FLAT_RATE',
                shippingServiceName: orderData.shippingServiceName || 'Standard Delivery',
                shippingServiceCode: orderData.shippingServiceCode || 'NG_FLAT_RATE',
                estimatedDeliveryDate: orderData.estimatedDeliveryDate || null,
                paymentStatus: 'paid',
                orderStatus: 'processing',
                totalAmount: payment.gross_amount_cents / 100,
                platformFee: payment.platform_fee_cents / 100,
                sellerAmount: payment.seller_amount_cents / 100,
                paymentMethod: 'paystack',
                paymentIntentId: reference,
                orderDate: new Date(),
                inventoryDeducted: true,
                inventoryDeductionLog: inventoryDeductions,
                currencyCode: 'NGN',
                baseCurrency: 'NGN'
            }], { session });

            payment.order_id = order[0]._id;
            payment.pending_order_data = undefined;
            await payment.save({ session });

            await adjustSellerBalance({
                session,
                sellerId: payment.seller_id,
                paymentId: payment._id,
                creditCents: payment.seller_amount_cents
            });
        }

        await updatePaystackCheckoutSessionStatus(reference, 'completed', session);
        await session.commitTransaction();

        // Fire-and-forget notifications — mirrors Stripe webhook pattern
        const createdOrderIds = payments.map(p => p.order_id).filter(Boolean);
        if (createdOrderIds.length > 0) {
            Order.find({ _id: { $in: createdOrderIds } }).lean().then(createdOrders => {
                for (const payment of payments) {
                    if (!payment.order_id) continue;
                    const order = createdOrders.find(o => o._id.toString() === payment.order_id.toString());
                    if (order) {
                        notifySeller(payment.seller_id, order, payment).catch(err =>
                            console.error('Paystack: failed to notify seller:', err)
                        );
                    }
                }
                if (createdOrders.length > 0) {
                    notifyBuyer(payments[0].buyer_id, payments, createdOrders).catch(err =>
                        console.error('Paystack: failed to notify buyer:', err)
                    );
                }
            }).catch(err => console.error('Paystack: failed to load orders for notifications:', err));
        }

        return res.status(200).json({ received: true });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error('Paystack webhook error:', error);
        return res.status(500).json({ error: 'Webhook handler failed' });
    } finally {
        session.endSession();
    }
};

/**
 * Poll Paystack payment status by reference.
 * Used by the frontend after the Paystack popup closes.
 */
module.exports.getPaystackPaymentStatus = async (req, res) => {
    try {
        const { reference } = req.params;
        const buyerId = req.user?.id;

        if (!reference) {
            return res.status(400).json({ error: 'reference is required' });
        }

        const payments = await Payment.find({
            paystack_reference: reference,
            buyer_id: buyerId,
            gateway: 'paystack'
        }).lean();

        if (!payments.length) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        const productPayments = payments.filter(p => p.seller_id);
        const orderIds = productPayments.map(p => p.order_id).filter(Boolean);

        const orders = orderIds.length
            ? await Order.find({ _id: { $in: orderIds }, userId: buyerId }).lean()
            : [];

        const confirmedOrders = productPayments.filter(
            p => p.status === 'succeeded' && p.order_id
        ).length;
        const expectedOrders = productPayments.length;

        const state = confirmedOrders === expectedOrders && expectedOrders > 0
            ? 'confirmed'
            : payments.some(p => p.status === 'failed') ? 'failed' : 'processing';

        return res.status(200).json({
            success: true,
            state,
            reference,
            expectedOrders,
            confirmedOrders,
            orders: orders.map(o => ({
                id: o._id,
                orderStatus: o.orderStatus,
                paymentStatus: o.paymentStatus
            }))
        });
    } catch (error) {
        console.error('Paystack status error:', error);
        return res.status(500).json({ error: 'Failed to retrieve payment status' });
    }
};
