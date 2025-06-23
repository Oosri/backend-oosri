const adminSellerService = require('../services/adminSellerService');
const constants = require('../constants');

module.exports.getAllSellers = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { page = 1, limit = 10 } = req.query;

    const serviceResponse = await adminSellerService.getAllSellers({
      page,
      limit
    });

    response.status = 200;
    response.message = constants.adminSellerMessage.SELLERS_FETCHED;
    response.body = serviceResponse;
  } catch (error) {
    console.log('Something went wrong: Controller: getAllSellers', error);
    response.status = 500;
    response.message =
      error.message || constants.adminSellerMessage.SELLER_FETCH_ERROR;
  }
  return res.status(response.status).send(response);
};

module.exports.getSellerById = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { sellerId } = req.params;
    const serviceResponse = await adminSellerService.getSellerById(sellerId);

    response.status = 200;
    response.message = constants.adminSellerMessage.SELLER_FETCHED_BY_ID;
    response.body = serviceResponse;
  } catch (error) {
    console.error('Something went wrong: Controller: getSellerById', error);
    if (
      error.message === constants.adminSellerMessage.SELLER_NOT_FOUND ||
      error.message === constants.databaseMessage.INVALID_ID
    ) {
      response.status = 404;
    } else {
      response.status = 500;
    }
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.deleteSeller = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { sellerId } = req.params;
    await adminSellerService.deleteSeller(sellerId);

    response.status = 204;
    response.message = constants.adminSellerMessage.SELLER_REMOVED;
    response.body = {};
  } catch (error) {
    console.error('Something went wrong: Controller: deleteSeller', error);

    if (
      error.message === constants.adminSellerMessage.SELLER_NOT_FOUND ||
      error.message === constants.databaseMessage.INVALID_ID
    ) {
      response.status = 404;
    } else {
      response.status = 500;
    }
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.filterSellers = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { firstName, lastName, email, keyword, sortBy, page, limit } =
      req.query;

    const filters = {
      firstName,
      lastName,
      email,
      keyword,
      sortBy,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10
    };

    const result = await adminSellerService.filterSellers(filters);

    response.status = 200;
    response.message = constants.adminSellerMessage.SELLERS_FETCHED;
    response.body = {
      sellers: result.sellers,
      pagination: result.pagination
    };
  } catch (error) {
    console.error('Something went wrong: Controller: filterSellers', error);
    response.status = 500;
    response.message =
      error.message || constants.adminSellerMessage.SELLER_FETCH_ERROR;
  }
  return res.status(response.status).send(response);
};
