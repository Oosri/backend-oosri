const payStack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);


module.exports.initializeTransaction = async (email, amount, orderId) => {
    try {
      const transaction = await payStack.transaction.initialize({
        email: email,
        amount: amount * 100, 
        metadata: {
          orderId: orderId 
        }
      });
      
      const formattedData = transaction.data;
  
      return {
        statusCode: 200,
        data: {
          success: true,
          transactionId: formattedData.id,
          amount: formattedData.amount / 100, 
          currency: formattedData.currency,
          authorizationUrl: formattedData.authorization_url,
          reference: formattedData.reference
        }
      };
    } catch (error) {
      console.error('Something went wrong: Service: initializeTransaction', error);
      throw new Error('Payment initialization failed: ' + error.message);
    }
  };



  
  module.exports.verifyPayment = async (reference) => {
    try {
      const verification = await payStack.transaction.verify(reference);
  
      if (verification.data.status === 'success') {
        const formattedData = verification.data;
  
        const response = {
          success: true,
          payment_status: true,
          amount: formattedData.amount / 100, 
          currency: formattedData.currency,
          request_status: formattedData.status,
          reference: formattedData.reference
        };
  
        return {
          data: response
        };
      } else {
        const response = {
          success: false,
          payment_status: false,
          request_status: verification.data.status,
          reference: verification.data.reference,
          error: verification.data.gateway_response
        };
  
        return {
          data: response
        };
      }
    } catch (error) {
      console.error('Something went wrong: Service: verifyPayment', error);
      throw new Error('Payment verification failed: ' + error.message);
    }
  };
  