const buyerOrderService = require('../../Buyer/Service/buyerOrderService');
const constants = require('../constants');

module.exports.createOrder = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const reqBody = req.body; 
    const userId = req.user.id; 

    const serviceResponse = await buyerOrderService.createOrder({
      ...reqBody,  
      userId       
    });

    response.status = 201;
    response.message = constants.buyerOrderMessage.ORDER_CREATED;
    response.body = serviceResponse;
  } catch (error) {
    console.log('Something went wrong: Controller: createOrder', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};


  

module.exports.retrieveBuyerOrders = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const userId = req.user.id; 

    const skip = parseInt(req.query.skip) || 0; 
    const limit = parseInt(req.query.limit) || 10; 

    const serviceResponse = await buyerOrderService.retrieveBuyerOrders(userId, { skip, limit });
    if(serviceResponse.length === 0){
      response.status = 200;
     response.message = constants.buyerOrderMessage.USER_ORDER_NOT_FOUND;
    }else{
      response.status = 200;
      response.message = constants.buyerOrderMessage.ORDER_FETCHED;
      response.body = serviceResponse;
    }
  } catch (error) {
    console.log('Something went wrong: Controller: getOrdersByUserId', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};



   module.exports.buyerCancelOrder  = async (req, res) => {
    let response = { ...constants.customServerResponse };
        try {
            const { orderId } = req.params;  
            const userId = req.user.id;     
            const result = await buyerOrderService.buyerCancelOrder(orderId, userId);
            response.status = 200;
            response.message = constants.buyerOrderMessage.CANCELLED_ORDER;
        } catch (error) {
          console.log('Something went wrong: Controller:buyerCancelOrder', error);
          response.message = error.message;
        }
        return res.status(response.status).json(response);
    };



      module.exports.retrieveSellerOrders = async (req, res) => {
        let response = { ...constants.customServerResponse };
          try {
              const sellerId =req.sellerId;
              const skip = parseInt(req.query.skip) || 0; 
              const limit = parseInt(req.query.limit) || 10; 
              const serviceResponse = await buyerOrderService.retrieveSellerOrders(sellerId, { skip, limit });
              if(serviceResponse.length === 0){
                response.status = 200;
               response.message = constants.buyerOrderMessage.USER_ORDER_NOT_FOUND;
              }else{
                response.status = 200;
                response.message = constants.buyerOrderMessage.ORDER_FETCHED;
                response.body = serviceResponse;
              }
  
             
          } catch (error) {
            console.log('Something went wrong: Controller:retrieveSellerOrder', error);
            response.message = error.message;
          }
          return res.status(response.status).json(response);
      };
  
       module.exports.retrieveOrderById= async (req, res) => {
        let response = { ...constants.customServerResponse };
        try {
            const serviceResponse = await buyerOrderService.retrieveOrderById(req.params.id);
            response.status = 200;
          response.message = constants.buyerOrderMessage.ORDER_FETCHED;
         response.body = serviceResponse;
        } catch (error) {
          console.log('Something went wrong: Controller:retrieveOrderById', error);
          response.message = error.message;
        }
        return res.status(response.status).json(response);
    };

    module.exports.retrieveUserDeliveryAddresses = async (req, res) => {
      let response = { ...constants.customServerResponse };
      try {
          const userId = req.user.id; 
          const serviceResponse = await buyerOrderService.retrieveUserDeliveryAddresses(userId);
          response.status = 200;
        response.message = constants.buyerOrderMessage.DELIVERY_ADDRESSES_FETCHED;
       response.body = serviceResponse;
      } catch (error) {
        console.log('Something went wrong: Controller:retrieveUserDeliveryAddresses', error);
        response.message = error.message;
      }
      return res.status(response.status).json(response);
  };
    