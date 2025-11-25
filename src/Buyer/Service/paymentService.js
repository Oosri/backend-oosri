const { toStripeAmount } = require('../../utils/money');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = {
    createPaymentIntent: async (amount, orderId, sellerId, buyerId, currency) => {
        const stripeAmount = toStripeAmount(amount, currency);
        const paymentIntent = await stripe.paymentIntents.create({
            amount: stripeAmount,
            currency: currency?.toLowerCase(),
            automatic_payment_methods: {
                enabled: true
            },
            metadata: {
                orderId,
                sellerId,
                buyerId
            }
        });

        return paymentIntent;
    },
}