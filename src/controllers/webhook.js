
const Stripe = require('stripe');
const { Payment, SellerLedger, Seller } = require('../models');
const { Payment } = require('../Buyer/models/paymentModel');
const { SellerLedger } = require('../models/sellerLedgerModel');
const { Seller } = require('../models/sellerModel');
const { mongoose } = require("mongoose");


const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // This prevents attackers from sending fake webhooks
        event = stripe.webhooks.constructEvent(
            req.body,        // Raw body
            sig,             // Signature header
            process.env.STRIPE_WEBHOOK_SECRET // Your secret
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
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

        // MUST return 200 quickly (within 5 seconds)
        // Or Stripe will retry the webhook
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
            session.endSession();
            return;
        }

        if (payment.status === 'succeeded') {
            console.log(`Payment ${paymentIntent.id} has already been processed.`);
            await session.abortTransaction();
            session.endSession();
            return;
        }

        payment.status = 'succeeded';
        payment.raw.paymentIntent = paymentIntent;

        const charge = paymentIntent.charges?.data?.[0];
        if (charge) {
            payment.stripe_charge_id = charge.id;
            if (charge.balance_transaction) {
                const balanceTransaction = await stripe.balanceTransactions.retrieve(charge.balance_transaction);
                payment.stripe_fee_cents = balanceTransaction.fee;
            }
        }

        await payment.save({ session });

        const seller = await Seller.findById(payment.seller_id);
        if (!seller) {
            throw new Error(`Seller not found for ID: ${payment.seller_id}`);
        }

        const credit = payment.seller_amount_cents;

        const lastLedger = await SellerLedger.findOne({ seller_id: seller._id }).sort({ createdAt: -1 }).session(session);
        const prevBalance = lastLedger ? lastLedger.balance_after_cents : 0;
        const newBalance = prevBalance + credit;

        await SellerLedger.create([{
            seller_id: seller._id,
            payment_id: payment._id,
            credit_cents: credit,
            balance_after_cents: newBalance
        }], { session });

        await session.commitTransaction();
        console.log(`Payment ${paymentIntent.id} succeeded. Credited seller ${seller._id} ${credit} cents. New balance ${newBalance}`);

    } catch (error) {
        await session.abortTransaction();
        console.error(`Error in handlePaymentSuccess for payment_intent ${paymentIntent.id}:`, error);
        throw error; // Re-throw to be caught by the main webhook handler
    } finally {
        session.endSession();
    }
}

async function handlePaymentFailure(paymentIntent) {
    console.log(`Payment failed: ${paymentIntent.id}`);
    const payment = await Payment.findOne({ stripe_payment_intent_id: paymentIntent.id });

    if (!payment) {
        console.warn(`Payment record not found for failed payment_intent ${paymentIntent.id}`);
        return;
    }

    if (payment.status !== 'succeeded') {
        payment.status = 'failed';
        payment.raw.paymentIntent = paymentIntent;
        await payment.save();
        console.log(`Payment ${paymentIntent.id} status updated to 'failed'.`);
    }
}

async function handlePaymentCanceled(paymentIntent) {
    console.log(`Payment canceled: ${paymentIntent.id}`);
    const payment = await Payment.findOne({ stripe_payment_intent_id: paymentIntent.id });

    if (!payment) {
        console.warn(`Payment record not found for canceled payment_intent ${paymentIntent.id}`);
        return;
    }

    if (payment.status !== 'succeeded') {
        payment.status = 'failed'; // Or a new 'canceled' status if you add it to the schema
        payment.raw.paymentIntent = paymentIntent;
        await payment.save();
        console.log(`Payment ${paymentIntent.id} status updated to 'failed' due to cancellation.`);
    }
}


async function handleChargeRefunded(charge) {
    // find payment by charge.payment_intent
    const piId = charge.payment_intent;
    const payment = await Payment.findOne({ stripe_payment_intent_id: piId });
    if (!payment) return console.warn('Refund: payment not found', piId);


    payment.status = 'refunded';
    await payment.save();


    // debit seller ledger
    const refundAmount = charge.amount; // in cents
    const lastLedger = await SellerLedger.findOne({ seller_id: payment.seller_id }).sort({ createdAt: -1 });
    const prevBalance = lastLedger ? lastLedger.balance_after_cents : 0;
    const newBalance = prevBalance - refundAmount;


    await SellerLedger.create({ seller_id: payment.seller_id, payment_id: payment._id, debit_usd_cents: refundAmount, balance_after_cents: newBalance });


    // optionally mark seller as frozen if negative beyond threshold
    if (newBalance < 0) {
        await Seller.findByIdAndUpdate(payment.seller_id, { is_frozen: true });
    }


    console.log(`Refund processed for PI ${piId}. Debited seller ${payment.seller_id} ${refundAmount} cents. New balance ${newBalance}`);
}


async function handleDisputeCreated(dispute) {
    // dispute.charge contains charge id
    const chargeId = dispute.charge;
    // find payment by stripe_charge_id
    const payment = await Payment.findOne({ stripe_charge_id: chargeId });
    if (!payment) return console.warn('Dispute: payment not found for charge', chargeId);


    payment.status = 'disputed';
    await payment.save();


    // freeze seller
    await Seller.findByIdAndUpdate(payment.seller_id, { is_frozen: true });


    // create ledger debit to reflect hold (you may reserve an amount instead)
    const disputeAmount = dispute.amount;
    const lastLedger = await SellerLedger.findOne({ seller_id: payment.seller_id }).sort({ createdAt: -1 });
    const prevBalance = lastLedger ? lastLedger.balance_after_cents : 0;
    const newBalance = prevBalance - disputeAmount;


    await SellerLedger.create({ seller_id: payment.seller_id, payment_id: payment._id, debit_usd_cents: disputeAmount, balance_after_cents: newBalance });


    console.log(`Dispute created for charge ${chargeId}. Seller ${payment.seller_id} frozen.`);
}


async function handleDisputeUpdated(dispute) {
    // handle status updates; simplified here
    console.log('Dispute updated', dispute.id, dispute.status);
}


async function handlePayoutPaid(payout) {
    // This webhook notifies your Stripe platform that Stripe sent money to your bank account.
    // Trigger Raenest transfer or mark funds available for Raenest.
    console.log('Payout paid', payout.id, payout.amount);
    // You can map payout to an internal Payout document if you recorded one before.
}