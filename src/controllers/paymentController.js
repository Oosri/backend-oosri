const { createPaymentIntent } = require("../Buyer/Service/paymentService");
const { Payment } = require("../models/paymentModel");
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '15');


module.exports.initPayment = async (req, res) => {
    const { sellerId, buyerId, amountInCents, orderId, currency } = req.body;
    if (!sellerId || !buyerId || !amountInCents || !orderId) {
        return res.status(400).json({
            error: "Missing required field(s)"
        })
    }

    if (amountInCents < 50) {
        return res.status(400).json({
            error: "Amount too small"
        });
    }

    const paymentIntent = await createPaymentIntent(sellerId, buyerId, amountInCents, orderId, currency);
    const platformFeeCent = Math.round(amountInCents * (PLATFORM_FEE_PERCENT / 100));
    const payment = await Payment.create({
        order_id: orderId,
        stripe_payment_intent_id: paymentIntent.id,
        buyer_id: buyerId,
        gross_amount_cents: amountInCents,
        seller_amount_cents: amountInCents - platformFeeCent,
        platform_fee_cents: platformFeeCent,
        currency,
        seller_id: sellerId,
        raw: paymentIntent,
        status: "pending",
        raw: { paymentIntent }
    });

    res.status(200).json({
        clientSecret: paymentIntent.client_secret,
        paymentId: payment._id
    })
}