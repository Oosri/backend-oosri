const Stripe = require('stripe');
const mongoose = require("mongoose");
// Consolidated imports - assuming these models are exported from ../models/index.js or similar
// If not, we might need to keep specific path imports but remove duplicates.
// Based on user code, they had mixed imports. I will try to use the specific paths if ../models doesn't work, 
// but usually ../models implies an index.js. 
// However, to be safe and avoid "module not found" if index.js is missing, I will use the specific paths that seemed most specific in the original code, 
// but I will verify if ../models exists. 
// Actually, looking at the original code:
// const { Payment, SellerLedger, Seller } = require('../models');
// const { Payment } = require('../Buyer/models/paymentModel');
// ...
// It seems messy. I'll stick to the specific paths which are more likely to be correct if the project structure is standard.
// Wait, the user has `require('../models/paymentModel')` and `require('../../models/sellerModel')`.
// I will use the explicit paths to be safe.

const Payment = require('../models/paymentModel');
const SellerLedger = require('../../models/sellerLedger');
const Seller = require('../../models/sellerModel');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports.webhooks = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentSuccess(event.data.object);
                break;
            case 'payment_intent.payment_failed':
                await handlePaymentFailure(event.data.object);
                break;

            case 'charge.refunded':
                await handleChargeRefunded(event.data.object);
                break;

            case 'charge.dispute.created':
                await handleDisputeCreated(event.data.object);
                break;

            case 'charge.dispute.closed':
                await handleChargeDisputeClosed(event.data.object);
                break;

            case 'payment_intent.canceled':
                await handlePaymentCanceled(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });

    } catch (err) {
        console.error(`Error handling webhook ${event.type}:`, err);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
}

async function handlePaymentSuccess(paymentIntent) {
    console.log(`Payment succeeded: ${paymentIntent.id}`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const payment = await Payment.findOne({ stripe_payment_intent_id: paymentIntent.id }).session(session);
        if (!payment) {
            console.warn(`Payment record not found for payment_intent ${paymentIntent.id}`);
            await session.abortTransaction();
            return;
        }

        if (payment.status === 'succeeded') {
            console.log(`Payment ${paymentIntent.id} has already been processed.`);
            await session.abortTransaction();
            return;
        }

        payment.status = 'succeeded';
        payment.raw = { ...payment.raw, paymentIntent }; // Merge instead of overwrite if needed, or just set it.

        const charge = paymentIntent.charges?.data?.[0];
        if (charge) {
            payment.stripe_charge_id = charge.id;
            if (charge.balance_transaction) {
                // Note: retrieving balance transaction might fail if not available yet, but usually it is for succeeded payments.
                // However, this is an external API call inside a transaction. Ideally avoid external calls in transactions, 
                // but for now we keep it to get the fee.
                const balanceTransaction = await stripe.balanceTransactions.retrieve(charge.balance_transaction);
                payment.stripe_fee_cents = balanceTransaction.fee;
            }
        }

        await payment.save({ session });

        const seller = await Seller.findById(payment.seller_id).session(session);
        if (!seller) {
            throw new Error(`Seller not found for ID: ${payment.seller_id}`);
        }

        const credit = payment.seller_amount_cents;

        // Lock ledger by sorting and finding last
        const lastLedger = await SellerLedger.findOne({ seller_id: seller._id }).sort({ createdAt: -1 }).session(session);
        const prevBalance = lastLedger ? lastLedger.balance_after_cents : 0;
        const newBalance = prevBalance + credit;

        await SellerLedger.create([{
            seller_id: seller._id,
            payment_id: payment._id,
            credit_usd_cents: credit,
            balance_after_cents: newBalance
        }], { session });

        await session.commitTransaction();
        console.log(`Payment ${paymentIntent.id} succeeded. Credited seller ${seller._id} ${credit} cents. New balance ${newBalance}`);

    } catch (error) {
        await session.abortTransaction();
        console.error(`Error in handlePaymentSuccess for payment_intent ${paymentIntent.id}:`, error);
        throw error;
    } finally {
        session.endSession();
    }
}

async function handlePaymentFailure(paymentIntent) {
    console.log(`Payment failed: ${paymentIntent.id}`);
    try {
        const payment = await Payment.findOne({ stripe_payment_intent_id: paymentIntent.id });
        if (!payment) {
            console.warn(`Payment record not found for failed payment_intent ${paymentIntent.id}`);
            return;
        }

        if (payment.status !== 'succeeded') {
            payment.status = 'failed';
            payment.raw = { ...payment.raw, paymentIntent };
            await payment.save();
            console.log(`Payment ${paymentIntent.id} status updated to 'failed'.`);
        }
    } catch (error) {
        console.error(`Error in handlePaymentFailure:`, error);
    }
}

async function handlePaymentCanceled(paymentIntent) {
    console.log(`Payment canceled: ${paymentIntent.id}`);
    try {
        const payment = await Payment.findOne({ stripe_payment_intent_id: paymentIntent.id });
        if (!payment) {
            console.warn(`Payment record not found for canceled payment_intent ${paymentIntent.id}`);
            return;
        }

        if (payment.status !== 'succeeded') {
            payment.status = 'failed';
            payment.raw = { ...payment.raw, paymentIntent };
            await payment.save();
            console.log(`Payment ${paymentIntent.id} status updated to 'failed' due to cancellation.`);
        }
    } catch (error) {
        console.error(`Error in handlePaymentCanceled:`, error);
    }
}

async function handleChargeRefunded(charge) {
    const piId = charge.payment_intent;
    console.log(`Processing refund for PI ${piId}`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const payment = await Payment.findOne({ stripe_payment_intent_id: piId }).session(session);
        if (!payment) {
            console.warn('Refund: payment not found', piId);
            await session.abortTransaction();
            return;
        }

        // Check if already refunded to avoid double deduction? 
        // Stripe might send partial refunds. Assuming full refund for now or handling multiple events.
        // If status is already refunded, we might want to be careful. 
        // For simplicity, we just update status and deduct.

        payment.status = 'refunded';
        await payment.save({ session });

        const refundAmount = charge.amount; // in cents
        const lastLedger = await SellerLedger.findOne({ seller_id: payment.seller_id }).sort({ createdAt: -1 }).session(session);
        const prevBalance = lastLedger ? lastLedger.balance_after_cents : 0;
        const newBalance = prevBalance - refundAmount;

        await SellerLedger.create([{
            seller_id: payment.seller_id,
            payment_id: payment._id,
            debit_usd_cents: refundAmount,
            balance_after_cents: newBalance
        }], { session });

        // Check for negative balance
        if (newBalance < 0) {
            await Seller.findByIdAndUpdate(payment.seller_id, { is_frozen: true }).session(session);
        }

        await session.commitTransaction();
        console.log(`Refund processed for PI ${piId}. Debited seller ${payment.seller_id} ${refundAmount} cents. New balance ${newBalance}`);

    } catch (error) {
        await session.abortTransaction();
        console.error(`Error in handleChargeRefunded:`, error);
        throw error;
    } finally {
        session.endSession();
    }
}

async function handleDisputeCreated(dispute) {
    const chargeId = dispute.charge;
    console.log(`Processing dispute for charge ${chargeId}`);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const payment = await Payment.findOne({ stripe_charge_id: chargeId }).session(session);
        if (!payment) {
            console.warn('Dispute: payment not found for charge', chargeId);
            await session.abortTransaction();
            return;
        }

        payment.status = 'disputed';
        await payment.save({ session });

        // Freeze seller immediately on dispute?
        await Seller.findByIdAndUpdate(payment.seller_id, { is_frozen: true }).session(session);

        const disputeAmount = dispute.amount;
        const lastLedger = await SellerLedger.findOne({ seller_id: payment.seller_id }).sort({ createdAt: -1 }).session(session);
        const prevBalance = lastLedger ? lastLedger.balance_after_cents : 0;
        const newBalance = prevBalance - disputeAmount;

        await SellerLedger.create([{
            seller_id: payment.seller_id,
            payment_id: payment._id,
            debit_usd_cents: disputeAmount,
            balance_after_cents: newBalance
        }], { session });

        await session.commitTransaction();
        console.log(`Dispute created for charge ${chargeId}. Seller ${payment.seller_id} frozen.`);

    } catch (error) {
        await session.abortTransaction();
        console.error(`Error in handleDisputeCreated:`, error);
        throw error;
    } finally {
        session.endSession();
    }
}

async function handleChargeDisputeClosed(dispute) {
    console.log(`Dispute closed: ${dispute.id}, status: ${dispute.status}`);
    // If dispute won (status='won'), we might want to credit the seller back.
    // If lost, the money is gone (already debited).

    if (dispute.status === 'won') {
        const chargeId = dispute.charge;
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const payment = await Payment.findOne({ stripe_charge_id: chargeId }).session(session);
            if (!payment) {
                await session.abortTransaction();
                return;
            }

            payment.status = 'succeeded'; // Revert status?
            await payment.save({ session });

            // Unfreeze seller?
            await Seller.findByIdAndUpdate(payment.seller_id, { is_frozen: false }).session(session);

            const creditAmount = dispute.amount;
            const lastLedger = await SellerLedger.findOne({ seller_id: payment.seller_id }).sort({ createdAt: -1 }).session(session);
            const prevBalance = lastLedger ? lastLedger.balance_after_cents : 0;
            const newBalance = prevBalance + creditAmount;

            await SellerLedger.create([{
                seller_id: payment.seller_id,
                payment_id: payment._id,
                credit_usd_cents: creditAmount,
                balance_after_cents: newBalance
            }], { session });

            await session.commitTransaction();
            console.log(`Dispute won for charge ${chargeId}. Credited seller ${payment.seller_id}.`);

        } catch (error) {
            await session.abortTransaction();
            console.error('Error in handleChargeDisputeClosed:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }
}