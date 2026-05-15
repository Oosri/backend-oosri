const adminBuyerService = require('../services/adminBuyerService');
const constants = require('../constants');

module.exports.getAllBuyers = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { page = 1, limit = 20, searchTerm = '' } = req.query;
    const data = await adminBuyerService.getAllBuyers({ page, limit, searchTerm });
    response.status  = 200;
    response.message = 'Buyers fetched successfully';
    response.body    = data;
  } catch (error) {
    response.status  = 500;
    response.message = error.message || 'Failed to fetch buyers';
  }
  return res.status(response.status).send(response);
};

module.exports.getBuyerById = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { buyerId } = req.params;
    const data = await adminBuyerService.getBuyerById(buyerId);
    response.status  = 200;
    response.message = 'Buyer fetched successfully';
    response.body    = data;
  } catch (error) {
    response.status  = error.message === 'Buyer not found' || error.message === constants.databaseMessage.INVALID_ID ? 404 : 500;
    response.message = error.message || 'Failed to fetch buyer';
  }
  return res.status(response.status).send(response);
};

module.exports.suspendBuyer = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { buyerId } = req.params;
    const { reason }  = req.body;
    const data = await adminBuyerService.suspendBuyer(buyerId, reason);
    response.status  = 200;
    response.message = 'Buyer suspended successfully';
    response.body    = data;
  } catch (error) {
    response.status  = error.message === 'Buyer not found' ? 404 : 500;
    response.message = error.message || 'Failed to suspend buyer';
  }
  return res.status(response.status).send(response);
};

module.exports.unsuspendBuyer = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { buyerId } = req.params;
    const data = await adminBuyerService.unsuspendBuyer(buyerId);
    response.status  = 200;
    response.message = 'Buyer unsuspended successfully';
    response.body    = data;
  } catch (error) {
    response.status  = error.message === 'Buyer not found' ? 404 : 500;
    response.message = error.message || 'Failed to unsuspend buyer';
  }
  return res.status(response.status).send(response);
};
