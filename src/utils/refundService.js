const Stripe = require('stripe');
const axios = require('axios');
const Payment = require('../Buyer/models/paymentModel');
const Order = require('../Buyer/models/buyerOrderModel');

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = {
  processRefund: async ({ orderId, amountCents, reason = 'requested_by_customer' }) => {
    const payment = await Payment.findOne({ order_id: orderId });
    if (!payment) throw new Error('Payment record not found for this order');

    const refundAmount = amountCents || payment.gross_amount_cents;
    if (!refundAmount || refundAmount <= 0) throw new Error('Invalid refund amount');

    let gatewayRefundId;

    if (payment.gateway === 'stripe') {
      if (!payment.stripe_payment_intent_id) throw new Error('Stripe payment intent ID missing');
      const stripe = getStripe();
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripe_payment_intent_id,
        amount: refundAmount,
        reason,
      });
      gatewayRefundId = refund.id;

    } else if (payment.gateway === 'paystack') {
      if (!payment.paystack_reference) throw new Error('Paystack transaction reference missing');
      const response = await axios.post(
        'https://api.paystack.co/refund',
        { transaction: payment.paystack_reference, amount: refundAmount },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.data?.status) throw new Error(response.data?.message || 'Paystack refund failed');
      gatewayRefundId = String(response.data.data.id || response.data.data.transaction_reference);

    } else {
      throw new Error(`Unsupported payment gateway: ${payment.gateway}`);
    }

    payment.status = 'refunded';
    payment.refund_amount_cents = refundAmount;
    payment.recovery_state = 'refunded';
    payment.recovery_refund_id = gatewayRefundId;
    payment.recovery_attempted_at = new Date();
    await payment.save();

    await Order.updateOne(
      { _id: orderId },
      {
        $set: {
          paymentStatus: 'refunded',
          refundAmount: refundAmount / 100,
        },
      }
    );

    return gatewayRefundId;
  },
};
