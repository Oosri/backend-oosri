const { Worker } = require('bullmq');
const Redis = require('ioredis');
const dotenv = require('dotenv');
dotenv.config();

const emailService = require('../utils/emailService');
const Seller = require('../models/sellerModel');
const Buyer = require('../Buyer/models/buyerAuthModel');

const EMAIL_QUEUE_NAME = 'email-queue';

// Build an explicit options object so auth credentials are never mis-parsed
// from a URL string (a common source of silent connection failures with BullMQ).
const redisConnectionOptions = {
    host: process.env.REDISHOST || '127.0.0.1',
    port: parseInt(process.env.REDISPORT || '6379', 10),
    ...(process.env.REDISPASSWORD && { password: process.env.REDISPASSWORD }),
    ...(process.env.REDISUSER && { username: process.env.REDISUSER }),
    maxRetriesPerRequest: null, // Required by BullMQ
};

// If a full REDIS_URL is provided, use it directly — BullMQ accepts a URL string
// in its connection config as well, so this covers hosted providers (Upstash, Railway, etc.)
const redisConnection = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new Redis(redisConnectionOptions);

const emailWorker = new Worker(EMAIL_QUEUE_NAME, async (job) => {
    const { name, data } = job;
    console.log(`Processing email job: ${name}`);

    try {
        switch (name) {
            case 'seller-order':
                await handleSellerOrder(data);
                break;
            case 'buyer-confirmation':
                await handleBuyerConfirmation(data);
                break;
            case 'payment-failure':
                await handlePaymentFailure(data);
                break;
            case 'seller-refund':
                await handleSellerRefund(data);
                break;
            case 'support-dispute':
                await handleSupportDispute(data);
                break;
            case 'buyer-stock-failure':
                await handleBuyerStockFailure(data);
                break;
            case 'support-urgent-refund':
                await handleSupportUrgentRefund(data);
                break;
            case 'seller-otp':
                await handleSellerOtp(data);
                break;
            case 'seller-reset-password':
                await handleSellerResetPassword(data);
                break;
            case 'logistics-processing-required':
                await handleLogisticsProcessingRequired(data);
                break;
            case 'logistics-shipment-success':
                await handleLogisticsShipmentSuccess(data);
                break;
            case 'buyer-return-update':
                await handleBuyerReturnUpdate(data);
                break;
            default:

                console.warn(`Unknown email job type: ${name}`);
        }
    } catch (error) {
        console.error(`Error processing email job ${name}:`, error);
        throw error; // Re-throw to allow BullMQ to retry
    }
}, {
    connection: redisConnection,
    concurrency: 5 // Process up to 5 emails in parallel
});

// Helper handlers (based on logic in buyersPaymentController.js)

async function handleSellerOrder(data) {
    const { sellerId, orderId, buyerName, grossAmountNGN, itemsList, netAmountNGN, platformFeeNGN } = data;
    const seller = await Seller.findById(sellerId);
    if (!seller) return;

    await emailService.sellerOrderNotification(
        seller.email,
        `${seller.firstName} ${seller.lastName}`,
        orderId,
        buyerName,
        grossAmountNGN,
        itemsList,
        netAmountNGN,
        platformFeeNGN
    );
}

async function handleBuyerConfirmation(data) {
    const { buyerId, totalAmount, currencySymbol, orderCount, ordersList } = data;
    const buyer = await Buyer.findById(buyerId);
    if (!buyer) return;

    await emailService.buyerPurchaseConfirmation(
        buyer.email,
        buyer.fullName,
        totalAmount,
        currencySymbol,
        orderCount,
        ordersList
    );
}

async function handlePaymentFailure(data) {
    const { buyerId, failureReason } = data;
    const buyer = await Buyer.findById(buyerId);
    if (!buyer) return;

    await emailService.paymentFailureNotification(
        buyer.email,
        buyer.fullName,
        failureReason
    );
}

async function handleSellerRefund(data) {
    const { sellerId, orderId, refundAmount } = data;
    const seller = await Seller.findById(sellerId);
    if (!seller) return;

    await emailService.sellerRefundNotification(
        seller.email,
        `${seller.firstName} ${seller.lastName}`,
        orderId,
        refundAmount
    );
}

async function handleSupportDispute(data) {
    const { supportEmail, disputeId, reason, paymentIds } = data;
    await emailService.supportDisputeAlert(supportEmail, disputeId, reason, paymentIds);
}

async function handleBuyerStockFailure(data) {
    const { buyerId, errorMessage } = data;
    const buyer = await Buyer.findById(buyerId);
    if (!buyer) return;

    await emailService.buyerStockFailureNotification(
        buyer.email,
        buyer.fullName,
        errorMessage
    );
}

async function handleSupportUrgentRefund(data) {
    const { supportEmail, paymentIntentId, buyerId, totalAmount, paymentIds, originalError, refundError } = data;
    await emailService.supportUrgentRefundAlert(
        supportEmail,
        paymentIntentId,
        buyerId,
        totalAmount,
        paymentIds,
        originalError,
        refundError
    );
}

async function handleSellerOtp(data) {
    const { email, otpArray, firstName } = data;
    await emailService.sendOtpEmail(email, otpArray, firstName);
}

async function handleSellerResetPassword(data) {
    const { email, otpArray, firstName } = data;
    await emailService.passwordResetCode(email, otpArray, firstName);
}

async function handleLogisticsShipmentSuccess(data) {
    const { to, ...payload } = data;
    await emailService.logisticsShipmentSuccessAlert(to, payload);
}

async function handleLogisticsProcessingRequired(data) {

    const { to, ...payload } = data;
    await emailService.logisticsManualProcessingAlert(to, payload);
}

async function handleBuyerReturnUpdate(data) {
    const { buyerId, orderId, returnStatus, statusMessage } = data;
    const buyer = await Buyer.findById(buyerId);
    if (!buyer) return;
    await emailService.buyerReturnStatusUpdate(buyer.email, buyer.fullName, orderId, returnStatus, statusMessage);
}

emailWorker.on('completed', (job) => {
    console.log(`Email job ${job.id} has completed!`);
});

emailWorker.on('failed', (job, err) => {
    console.log(`Email job ${job.id} has failed with ${err.message}`);
});

module.exports = emailWorker;
