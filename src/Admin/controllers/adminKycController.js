const adminKycService = require('../services/adminKycService');
const constants = require('../constants');

module.exports.getAllKyc = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const serviceResponse = await adminKycService.getAllKyc({ page, limit, status, search });
    response.status = 200;
    response.message = constants.kycMessage.KYC_FETCHED;
    response.body = serviceResponse;
  } catch (error) {
    console.error('getAllKyc error:', error);
    response.status = 500;
    response.message = error.message || constants.kycMessage.KYC_FETCH_ERROR;
  }
  return res.status(response.status).send(response);
};

module.exports.getKycById = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { kycId } = req.params;
    const serviceResponse = await adminKycService.getKycById(kycId);
    response.status = 200;
    response.message = constants.kycMessage.KYC_FETCHED_BY_ID;
    response.body = serviceResponse;
  } catch (error) {
    console.error('getKycById error:', error);
    const notFound = [constants.kycMessage.KYC_NOT_FOUND, constants.databaseMessage.INVALID_ID];
    response.status = notFound.includes(error.message) ? 404 : 500;
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.approveKyc = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { kycId } = req.params;
    const adminId = req.user?.id || req.adminUser?._id;
    const serviceResponse = await adminKycService.approveKyc(kycId, adminId);
    response.status = 200;
    response.message = constants.kycMessage.KYC_APPROVED;
    response.body = serviceResponse;
  } catch (error) {
    console.error('approveKyc error:', error);
    const notFound = [constants.kycMessage.KYC_NOT_FOUND, constants.databaseMessage.INVALID_ID];
    const conflict = [constants.kycMessage.KYC_ALREADY_APPROVED];
    if (notFound.includes(error.message)) response.status = 404;
    else if (conflict.includes(error.message)) response.status = 409;
    else response.status = 500;
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.rejectKyc = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { kycId } = req.params;
    const { reason } = req.body;
    const adminId = req.user?.id || req.adminUser?._id;
    const serviceResponse = await adminKycService.rejectKyc(kycId, adminId, reason);
    response.status = 200;
    response.message = constants.kycMessage.KYC_REJECTED;
    response.body = serviceResponse;
  } catch (error) {
    console.error('rejectKyc error:', error);
    const notFound = [constants.kycMessage.KYC_NOT_FOUND, constants.databaseMessage.INVALID_ID];
    response.status = notFound.includes(error.message) ? 404 : 500;
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};
