const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = {

  initializeTransaction: async (email, amount, orderId) => {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), 
         currency: 'usd',
        receipt_email: email,
        metadata: { orderId },
      });

      return {
        statusCode: 200,
        data: {
          success: true,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          clientSecret: paymentIntent.client_secret,
        },
      };
    } catch (error) {
      console.error('Something went wrong: Service: initializeTransaction', error);
      throw new Error('Payment initialization failed: ' + error.message);
    }
  },

  
  verifyPayment: async (paymentIntentId) => {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        return {
          data: {
            success: true,
            payment_status: true,
            amount: paymentIntent.amount / 100, 
            currency: paymentIntent.currency,
            request_status: paymentIntent.status,
            paymentIntentId: paymentIntent.id,
            orderId: paymentIntent.metadata?.orderId || null,
          },
        };
      } else {
        return {
          data: {
            success: false,
            payment_status: false,
            request_status: paymentIntent.status,
            paymentIntentId: paymentIntent.id,
            orderId: paymentIntent.metadata?.orderId || null,
            error: paymentIntent.last_payment_error?.message || 'Payment not completed',
          },
        };
      }
    } catch (error) {
      console.error('Something went wrong: Service: verifyPayment', error);
      throw new Error('Payment verification failed: ' + error.message);
    }
  },
};
