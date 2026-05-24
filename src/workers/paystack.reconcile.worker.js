/**
 * Paystack Reconciliation Worker
 *
 * Runs every 2 minutes and processes any Paystack payments that are still
 * 'pending' but have been confirmed by Paystack. This is the safety net for
 * three failure modes:
 *   1. Webhook URL not configured / stale (e.g. ngrok restart)
 *   2. Buyer closed the tab before the verify-fallback polled
 *   3. Transient network error caused the webhook to fail on first delivery
 *
 * Idempotency: only processes payments with status === 'pending'. Once a
 * payment is marked 'succeeded', it is skipped on all future runs.
 */

const mongoose = require('mongoose');
const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);
const redis = require('../configs/redis');

const Payment = require('../Buyer/models/paymentModel');
const Order = require('../Buyer/models/buyerOrderModel');
const { Product } = require('../models/productModel');
const Seller = require('../models/sellerModel');
const Buyer = require('../Buyer/models/buyerAuthModel');
const SellerLedger = require('../models/sellerLedger');
const CheckoutSession = require('../Buyer/models/checkoutSessionModel');
const SellerNotification = require('../models/sellerNotificationModel');
const createNotificationService = require('../utils/notificationService');
const { addEmailJob } = require('../queues/email.queue');
const buyerCartService = require('../Buyer/Service/buyerCartService');

const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '15');
const sellerNotifSvc = createNotificationService(SellerNotification, 'sellerId');

// Only reconcile payments that are at least 5 minutes old — gives the webhook
// and the verify-fallback (frontend polling) enough time to run first.
const MIN_AGE_MS = 5 * 60 * 1000;

// Distributed lock — ensures only one API instance runs the reconciliation loop
// at a time. TTL is 110s (slightly under the 120s cron interval) so the lock
// auto-expires even if the process crashes without reaching releaseLock().
const LOCK_KEY = 'reconcile:paystack:lock';
const LOCK_TTL_SECONDS = 110;

async function acquireLock() {
    try {
        const result = await redis.set(LOCK_KEY, '1', 'NX', 'EX', LOCK_TTL_SECONDS);
        return result === 'OK';
    } catch (err) {
        // Redis is unavailable — fail open so payments don't get stuck.
        // Idempotency checks inside processReference still protect against
        // double-processing in this rare case.
        console.warn('[Paystack reconcile] Redis lock unavailable, proceeding without lock:', err.message);
        return true;
    }
}

async function releaseLock() {
    try {
        await redis.del(LOCK_KEY);
    } catch (err) {
        console.warn('[Paystack reconcile] Failed to release Redis lock:', err.message);
    }
}

async function reconcilePendingPaystackPayments() {
    const acquired = await acquireLock();
    if (!acquired) {
        console.log('[Paystack reconcile] Another instance is running — skipping this tick');
        return;
    }

    try {
        const cutoff = new Date(Date.now() - MIN_AGE_MS);

        // Find all pending Paystack payments older than the cutoff
        const pendingPayments = await Payment.find({
            gateway: 'paystack',
            status: 'pending',
            createdAt: { $lt: cutoff },
            paystack_reference: { $exists: true, $ne: null }
        }).lean();

        if (!pendingPayments.length) return;

        // Group by reference — each reference represents one checkout session
        const byReference = {};
        for (const p of pendingPayments) {
            const ref = p.paystack_reference;
            if (!byReference[ref]) byReference[ref] = [];
            byReference[ref].push(p);
        }

        console.log(`[Paystack reconcile] Found ${Object.keys(byReference).length} reference(s) to check`);

        for (const [reference, paymentsForRef] of Object.entries(byReference)) {
            await processReference(reference, paymentsForRef);
        }
    } finally {
        await releaseLock();
    }
}

async function processReference(reference, paymentsSnapshot) {
    // Verify with Paystack
    let paystackData;
    try {
        const result = await paystack.transaction.verify(reference);
        paystackData = result?.data;
    } catch (err) {
        console.error(`[Paystack reconcile] Verify call failed for ${reference}:`, err.message);
        return;
    }

    if (!paystackData) {
        console.warn(`[Paystack reconcile] No data returned for ${reference}`);
        return;
    }

    if (paystackData.status === 'failed' || paystackData.status === 'abandoned') {
        await markAsFailed(reference, paystackData.status);
        return;
    }

    if (paystackData.status !== 'success') {
        // Still pending on Paystack's side — leave it for the next run
        return;
    }

    // Paystack confirmed success — process orders + deduct stock atomically
    const session = await mongoose.startSession();
    try {
        await session.startTransaction();

        const payments = await Payment.find({
            paystack_reference: reference,
            gateway: 'paystack'
        }).session(session);

        // Idempotency: if already processed by the webhook or verify-fallback, skip
        const productPayments = payments.filter(p => p.seller_id);
        const alreadyDone = productPayments.length > 0 &&
            productPayments.every(p => p.status === 'succeeded' && p.order_id);
        if (alreadyDone) {
            await session.commitTransaction();
            console.log(`[Paystack reconcile] ${reference} already processed — skipping`);
            return;
        }

        const inventoryDeductions = [];

        for (const payment of payments) {
            if (payment.status === 'succeeded' && payment.order_id) continue;

            payment.status = 'succeeded';
            payment.raw = paystackData;
            await payment.save({ session });

            const orderData = payment.pending_order_data;
            if (!orderData || orderData.type === 'shipping_fee') {
                payment.pending_order_data = undefined;
                payment.markModified('pending_order_data');
                await payment.save({ session });
                continue;
            }

            if (!Array.isArray(orderData.items)) {
                payment.status = 'requires_action';
                payment.failure_reason = 'Reconcile: missing items in order data';
                await payment.save({ session });
                continue;
            }

            // Deduct inventory atomically
            for (const item of orderData.items) {
                const product = await Product.findById(item.productId).session(session);
                if (!product) throw new Error(`Product not found: ${item.productId}`);

                if ((product.inStock ?? 0) < item.quantity) {
                    throw new Error(`Insufficient stock for ${product.productName}`);
                }

                const updated = await Product.findOneAndUpdate(
                    { _id: product._id, inStock: { $gte: item.quantity } },
                    { $inc: { inStock: -item.quantity, total_sales: item.quantity } },
                    { new: true, session }
                );

                if (!updated) throw new Error(`Inventory conflict for ${product.productName}`);

                inventoryDeductions.push({
                    productId: product._id,
                    quantityDeducted: item.quantity,
                    previousStock: product.inStock,
                    newStock: updated.inStock
                });

                item.stockAtOrderTime = product.inStock;
                item.stockAfterOrder = updated.inStock;
            }

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
            payment.markModified('pending_order_data');
            await payment.save({ session });

            await adjustSellerBalance({
                session,
                sellerId: payment.seller_id,
                paymentId: payment._id,
                creditCents: payment.seller_amount_cents
            });
        }

        await CheckoutSession.updateMany(
            { paystack_reference: reference },
            { $set: { status: 'completed', expires_at: new Date() } },
            { session }
        );

        await session.commitTransaction();
        console.info(`[Paystack reconcile] Orders committed for reference ${reference}`);

        // Post-commit: clear cart + send notifications (fire-and-forget)
        const buyerId = payments[0]?.buyer_id;
        if (buyerId) {
            buyerCartService.clearCart(buyerId).catch(err =>
                console.error('[Paystack reconcile] Failed to clear cart:', err)
            );
        }

        const createdOrderIds = payments.map(p => p.order_id).filter(Boolean);
        if (createdOrderIds.length > 0) {
            Order.find({ _id: { $in: createdOrderIds } }).lean().then(createdOrders => {
                const productPmts = payments.filter(p => p.seller_id && p.order_id);
                for (const payment of productPmts) {
                    const order = createdOrders.find(o => o._id.toString() === payment.order_id.toString());
                    if (order) sendSellerNotification(payment, order);
                }
                if (createdOrders.length > 0) sendBuyerNotification(buyerId, payments, createdOrders);
            }).catch(err => console.error('[Paystack reconcile] Failed to load orders for notifications:', err));
        }

    } catch (err) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error(`[Paystack reconcile] Transaction failed for ${reference}:`, err.message);
    } finally {
        session.endSession();
    }
}

async function markAsFailed(reference, paystackStatus) {
    try {
        await Payment.updateMany(
            { paystack_reference: reference, gateway: 'paystack', status: 'pending' },
            { $set: { status: 'failed', failure_reason: `Paystack status: ${paystackStatus}` } }
        );
        console.info(`[Paystack reconcile] Marked ${reference} as failed (${paystackStatus})`);
    } catch (err) {
        console.error(`[Paystack reconcile] Failed to mark ${reference} as failed:`, err.message);
    }
}

async function adjustSellerBalance({ session, sellerId, paymentId, creditCents }) {
    const seller = await Seller.findOneAndUpdate(
        { _id: sellerId },
        { $inc: { available_balance_cents: creditCents } },
        { new: true, session }
    );
    if (!seller) {
        console.warn(`[Paystack reconcile] Seller not found for balance update: ${sellerId}`);
        return;
    }
    try {
        await SellerLedger.create([{
            seller_id: sellerId,
            payment_id: paymentId,
            credit_usd_cents: creditCents,
            debit_usd_cents: 0,
            balance_after_cents: seller.available_balance_cents || 0,
        }], { session });
    } catch (err) {
        // E11000 means the webhook or verify fallback already credited this payment.
        // Rethrow so the enclosing transaction aborts and rolls back the $inc above.
        if (err.code === 11000) {
            throw new Error(`[Paystack reconcile] Payment ${paymentId} already credited — aborting to prevent double-credit`);
        }
        throw err;
    }
}

async function sendSellerNotification(payment, order) {
    try {
        const grossAmountNGN = payment.base_amount || 0;
        const platformFeeNGN = grossAmountNGN * (PLATFORM_FEE_PERCENT / 100);
        const netAmountNGN = grossAmountNGN - platformFeeNGN;
        const items = (order.products || []).map(item => ({
            productName: item.productName || item.name,
            quantity: item.quantity,
            price: (item.price || 0).toLocaleString()
        }));

        await addEmailJob('seller-order', {
            sellerId: payment.seller_id.toString(),
            orderId: order._id.toString(),
            buyerId: order.userId.toString(),
            grossAmountNGN: grossAmountNGN.toLocaleString(),
            items,
            netAmountNGN: netAmountNGN.toLocaleString(),
            platformFeeNGN: platformFeeNGN.toLocaleString()
        });

        const nameSnippet = items.length === 1
            ? items[0].productName
            : `${items[0].productName} + ${items.length - 1} more`;
        await sellerNotifSvc.create(
            payment.seller_id.toString(),
            'new_order',
            `New order received: ${nameSnippet}`,
            { orderId: order._id.toString() }
        );
    } catch (err) {
        console.error('[Paystack reconcile] Seller notification failed:', err.message);
    }
}

async function sendBuyerNotification(buyerId, payments, orders) {
    try {
        const totalAmount = payments.reduce((sum, p) => sum + (p.gross_amount_cents / 100), 0);
        const formattedTotal = Math.round(totalAmount).toLocaleString('en-NG');

        const ordersListHtml = orders.map(order => {
            const itemsHtml = (order.products || []).map(item =>
                `<p>${item.productName} &times;${item.quantity} &mdash; &#8358;${Math.round((item.price || 0) * (item.quantity || 1)).toLocaleString('en-NG')}</p>`
            ).join('');
            return `<p><strong>Order #${order._id.toString().slice(-8).toUpperCase()}</strong></p>${itemsHtml}`;
        }).join('<br/>');

        await addEmailJob('buyer-confirmation', {
            buyerId: buyerId.toString(),
            totalAmount: formattedTotal,
            currencySymbol: '₦',
            orderCount: orders.length,
            ordersList: ordersListHtml
        });
    } catch (err) {
        console.error('[Paystack reconcile] Buyer notification failed:', err.message);
    }
}

module.exports = { reconcilePendingPaystackPayments };
