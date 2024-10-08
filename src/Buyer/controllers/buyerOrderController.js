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
    response.status = 200;
    response.message = constants.buyerOrderMessage.ORDER_FETCHED;
    response.body = serviceResponse;
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






// module.exports.retrieveAllOrders = async (req, res) =>
//   {
//     let response = {...constants.customServerResponse }; 
//     try {
//       const serviceResponse = await orderService.retrieveAllOrders(req.query);
//         response.status = 200;
//         response.message = constants.orderMessage.ORDER_FETCHED;
//         response.body = serviceResponse;
     
//     } catch (error) {
//       console.log('Something went wrong: Controller: createOrder', error);
//       response.message = error.message;
//     }
//     return res.status(response.status).send(response);
//   }


  
//   module.exports.getOrdersByUserId = async (req, res) => {
//     let response = { ...constants.customServerResponse };
//     try {
//       const userId = req.user.id;
  
//       const serviceResponse = await orderService.retrieveOrdersByUserId(userId, req.query);
//         response.status = 200;
//         response.message = constants.orderMessage.ORDER_FETCHED;
//         response.body = serviceResponse;
    
    
//     } catch (error) {
//       console.log('Something went wrong: Controller: getOrdersByUserId', error);
//       response.status = 500;
//       response.message = error.message;
//     }
//     return res.status(response.status).json(response);
//   };


//   module.exports.updateExitingOrder = async (req, res) => {
//     let response = {...constants.customServerResponse }; 
//     try {
//       const responseFromService = await orderService.updateExistingOrder({
//         id: req.params.id,
//         updateInfo: req.body
//       });
//       response.status = 200;
//       response.message = constants.orderMessage.ORDER_UPDATED;
//       response.body = responseFromService;
//     } catch (error) {
//       console.log('Something went wrong: Controller: updateOrder', error);
//       response.message = error.message;
//     }
//     return res.status(response.status).send(response);
//   }
  

//   module.exports.removeOrder = async (req, res) => {
//     let response = {...constants.customServerResponse }; 
//     try {
//       const serviceResponse = await orderService.removeOrder(req.params);
//       response.status = 200;
//       response.message = constants.orderMessage.ORDER_REMOVED;
//       response.body = serviceResponse;
//     } catch (error) {
//       console.log('Something went wrong: Controller: deleteOrder', error);
//       response.message = error.message;
//     }
//     return res.status(response.status).send(response);
//   }