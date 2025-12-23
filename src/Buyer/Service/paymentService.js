const { toStripeAmount } = require('../../utils/money');

const stripe = require('stripe')(process.env.STRIPE_PAYMENT_TEST_KEY);

module.exports = {
    createPaymentIntent: async (amount, orderId, sellerId, buyerId, currency, isCents = false) => {
        const stripeAmount = isCents ? amount : toStripeAmount(amount, currency);

        // Only include non-null metadata values
        const metadata = { buyerId };
        if (orderId) metadata.orderId = orderId;
        if (sellerId) metadata.sellerId = sellerId;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: stripeAmount,
            currency: currency?.toLowerCase(),
            automatic_payment_methods: {
                enabled: true
            },
            metadata
        });

        return paymentIntent;
    },
}