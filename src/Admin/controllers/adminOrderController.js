const adminOrderService = require('../services/adminOrderService');
const constants = require('../constants');


module.exports.retrieveAllOrders = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;

    const filters = {
      customerName: req.query.customerName,
      sellerName: req.query.sellerName,
      orderStatus: req.query.orderStatus,
      buyerId: req.query.buyerId,
      dateFilter: req.query.dateFilter,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate
    };

    const serviceResponse = await adminOrderService.retrieveAllOrders({ skip, limit, filters });

    if (serviceResponse.length === 0) {
      response.status = 200;
      response.message = constants.adminOrderMessage.EMPTY_ORDER;
    } else {
      response.status = 200;
      response.message = constants.adminOrderMessage.ORDER_FETCHED;
      response.body = serviceResponse;
    }
  } catch (error) {
    console.error('Something went wrong: Controller: retrieveAllOrders', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};



module.exports.retrieveOrderById = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const serviceResponse = await adminOrderService.retrieveOrderById(req.params.id);
    response.status = 200;
    response.message = constants.adminOrderMessage.ORDER_FETCHED;
    response.body = serviceResponse;
  } catch (error) {
    console.error('Something went wrong: Controller:retrieveOrderById', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};


module.exports.searchOrders = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const searchTerm = req.query.searchTerm || '';

    const serviceResponse = await adminOrderService.searchOrders({ searchTerm, skip, limit });

    if (serviceResponse.orders.length === 0) {
      response.status = 200;
      response.message = constants.adminOrderMessage.EMPTY_ORDER;
    } else {
      response.status = 200;
      response.message = constants.adminOrderMessage.ORDER_FETCHED;
      response.body = serviceResponse;
    }
  } catch (error) {
    console.error('Something went wrong: Controller: searchOrders', error);
    response.message = error.message;
  }

  return res.status(response.status).json(response);
};

module.exports.updateOrderStatus = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const orderId = req.params.id;
    const { orderStatus } = req.body;

    const serviceResponse = await adminOrderService.updateOrderStatus(orderId, orderStatus);

    response.status = 200;
    response.message = constants.adminOrderMessage.ORDER_STATUS_UPDATED;
    response.body = serviceResponse;
  } catch (error) {
    console.error('Something went wrong: Controller: updateOrderStatus', error);
    response.status = error.message === constants.adminOrderMessage.INVALID_ORDER_ID ? 404 : 500;
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};
