const buyerPaymentService = require('../Service/buyerPaymentService');
const constants = require('../constants');

module.exports.initializeTransaction = async (req, res) => {
    let response = { ...constants.customServerResponse };

    try {
        const { orderId, amount } = req.body;
        const userId = req.user.id; 
        const currency = "NGN";

        const serviceResponse = await buyerPaymentService.InitializeTransaction(
            userId, 
            orderId, 
            amount,
            currency
        );

        if (serviceResponse.success === true) { 
            response.status = 200;
            response.message = constants.paymentServiceMessage.INITIALIZE_SUCCESS;
            response.body = serviceResponse; 
        } else {
            response.status = 400;
            response.message = constants.paymentServiceMessage.INITIALIZED_FAILED;
            response.body = serviceResponse; 
        }
    } catch (error) {
        console.error('Something went wrong: Controller: InitializeTransaction', error);
        response.message = error.message;
    }
    
    return res.status(response.status).send(response);
};



module.exports.verifyPayment = async (req, res) => {
    let response = { ...constants.customServerResponse };

    try {

        const serviceResponse = await buyerPaymentService.verifyPayment(req.params.id);
        if (serviceResponse.success) {
            response.status = 200;
            response.message = constants.paymentServiceMessage.VERIFY_SUCCESS;
            response.body = serviceResponse;
        } else {
            response.status = 400;
            response.message = constants.paymentServiceMessage.VERIFY_FAILED;
            response.body = serviceResponse;
        }

    } catch (error) {
        console.error('Something went wrong: Controller: verifyPayment', error);
        response.message = error.message;
    }
    return res.status(response.status).send(response);
};

