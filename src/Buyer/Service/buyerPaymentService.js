const payStack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);

module.exports = {
initializeTransaction: async (email, amount, orderId) => {
  console.log('Initializing transaction for:', { email, amount, orderId });
  try {
    const transaction = await payStack.transaction.initialize({
      email,
      amount: amount * 100,
      currency: 'NGN',
      metadata: { orderId }
    });

    const data = transaction.data;

    return {
      statusCode: 200,
      data: {
        success: true,
        transactionId: data.id, 
        amount: amount,         
        currency: 'NGN',
        authorizationUrl: data.authorization_url,
        reference: data.reference,
        metadata: { orderId }
      }
    };
  } catch (error) {
    console.error(
      'Something went wrong: Service: initializeTransaction',
      error.response?.body || error
    );
    throw new Error('Payment initialization failed');
  }
},

verifyPayment: async (reference) => {
  try {
    const verification = await payStack.transaction.verify(reference);
    const data = verification.data;

    const response = {
      success: data.status,
      payment_status: data.status,
      amount: data.amount / 100,
      currency: data.currency,
      reference: data.reference,
      metadata: data.metadata,
      orderId: data.metadata ? data.metadata.orderId : null,
    };

    return {
      status: data.status,
      data: response
    };
  } catch (error) {
    console.error('Something went wrong: Service: verifyPayment', error.response?.body || error);
    throw new Error('Payment verification failed');
  }
}

};
