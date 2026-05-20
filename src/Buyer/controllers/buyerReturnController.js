const returnRequestService = require('../../Admin/services/returnRequestService');
const constants = require('../constants');

module.exports.createReturnRequest = async (req, res) => {
  const response = { status: 400, success: false, message: '', body: {} };
  try {
    const { orderId, reason, reasonDetail, evidenceUrls } = req.body;
    const buyerId = req.user.id;

    if (!orderId || !reason) {
      response.message = 'orderId and reason are required';
      return res.status(400).json(response);
    }

    const result = await returnRequestService.createReturnRequest({
      orderId,
      buyerId,
      reason,
      reasonDetail,
      evidenceUrls: evidenceUrls || [],
    });

    response.status = 201;
    response.success = true;
    response.message = 'Return request submitted successfully';
    response.body = result;
  } catch (error) {
    console.error('Controller: buyerReturn.create', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};

module.exports.getMyReturns = async (req, res) => {
  const response = { status: 400, success: false, message: '', body: {} };
  try {
    const buyerId = req.user.id;
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;

    const result = await returnRequestService.getBuyerReturns({ buyerId, skip, limit });
    response.status = 200;
    response.success = true;
    response.message = 'Return requests fetched successfully';
    response.body = result;
  } catch (error) {
    console.error('Controller: buyerReturn.getMyReturns', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};

module.exports.getReturnById = async (req, res) => {
  const response = { status: 400, success: false, message: '', body: {} };
  try {
    const buyerId = req.user.id;
    const requestId = req.params.id;

    const result = await returnRequestService.getBuyerReturnById({ requestId, buyerId });
    response.status = 200;
    response.success = true;
    response.message = 'Return request fetched successfully';
    response.body = result;
  } catch (error) {
    console.error('Controller: buyerReturn.getReturnById', error);
    response.message = error.message;
    if (error.message === 'Return request not found') response.status = 404;
  }
  return res.status(response.status).json(response);
};
