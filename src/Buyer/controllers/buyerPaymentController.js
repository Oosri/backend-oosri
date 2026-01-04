const buyerPaymentService = require('../Service/buyerPaymentService');
const buyerOrderService = require('../Service/buyerOrderService');
const constants = require('../constants');

module.exports.initializeTransaction = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const { email, amount, orderId } = req.body;

    const serviceResponse = await buyerPaymentService.initializeTransaction(email, amount, orderId);

    if (serviceResponse.data.success) {
      response.status = 200;
      response.message = constants.paymentServiceMessage.INITIALIZE_SUCCESS;
      response.body = serviceResponse.data;
    } else {
      response.status = 400;
      response.message = constants.paymentServiceMessage.INITIALIZED_FAILED;
      response.body = serviceResponse.data;
    }
  } catch (error) {
    console.log('Something went wrong: Controller: initializeTransaction', error);
    response.status = 500;
    response.message = error.message;
  }

  return res.status(response.status).send(response);
};

module.exports.verifyPayment = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {

     const paymentIntentId = req.params.reference;


const paymentResult = await buyerPaymentService.verifyPayment(paymentIntentId);

const orderId = paymentResult.data.orderId;
if (!orderId) {
  response.status = 400;
  response.message = 'Order ID not found in payment metadata';
  response.body = paymentResult;
  return res.status(response.status).send(response);
}

const updateResult = await buyerOrderService.handlePaymentResult(
  orderId,
  paymentResult.data.payment_status 
);

if (updateResult.success) {
  response.status = 200;
  response.message = constants.paymentServiceMessage.VERIFY_SUCCESS;
} else {
  response.status = 400;
  response.message = constants.paymentServiceMessage.VERIFY_FAILED;
}

  } catch (error) {
    console.log('Something went wrong: Controller: verifyPayment', error);
    response.status = 500;
    response.message = error.message;
  }

  return res.status(response.status).send(response);
};
