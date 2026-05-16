const returnRequestService = require('../services/returnRequestService');
const returnSettingsService = require('../services/returnSettingsService');
const constants = require('../constants');

// ── Settings (super admin only) ───────────────────────────────────────────────

module.exports.getSettings = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    response.body = await returnSettingsService.getSettings();
    response.status = 200;
    response.message = constants.returnMessage.SETTINGS_FETCHED;
  } catch (error) {
    console.error('Controller: return.getSettings', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};

module.exports.updateSettings = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    response.body = await returnSettingsService.updateSettings(req.body);
    response.status = 200;
    response.message = constants.returnMessage.SETTINGS_UPDATED;
  } catch (error) {
    console.error('Controller: return.updateSettings', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};

// ── Return Requests ───────────────────────────────────────────────────────────

module.exports.getAllReturns = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const { status, search } = req.query;

    response.body = await returnRequestService.getAllReturns({ skip, limit, status, search });
    response.status = 200;
    response.message = constants.returnMessage.REQUEST_FETCHED;
  } catch (error) {
    console.error('Controller: return.getAllReturns', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};

module.exports.getReturnById = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    response.body = await returnRequestService.getReturnById(req.params.id);
    response.status = 200;
    response.message = constants.returnMessage.REQUEST_FETCHED;
  } catch (error) {
    console.error('Controller: return.getReturnById', error);
    response.message = error.message;
    if (error.message === constants.returnMessage.REQUEST_NOT_FOUND) response.status = 404;
  }
  return res.status(response.status).json(response);
};

module.exports.approveReturn = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { note, refundType, refundAmountCents } = req.body;
    const adminId = req.adminUser._id;
    const adminName = req.adminUser.fullName;

    response.body = await returnRequestService.approveReturn({
      requestId: req.params.id,
      adminId,
      adminName,
      note,
      refundType,
      refundAmountCents: refundAmountCents ? parseInt(refundAmountCents) : undefined,
    });
    response.status = 200;
    response.message = 'Return request approved';
  } catch (error) {
    console.error('Controller: return.approveReturn', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};

module.exports.rejectReturn = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { note } = req.body;
    const adminId = req.adminUser._id;
    const adminName = req.adminUser.fullName;

    response.body = await returnRequestService.rejectReturn({
      requestId: req.params.id,
      adminId,
      adminName,
      note,
    });
    response.status = 200;
    response.message = 'Return request rejected';
  } catch (error) {
    console.error('Controller: return.rejectReturn', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};

module.exports.triggerRefund = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const adminId = req.adminUser._id;
    const adminName = req.adminUser.fullName;

    response.body = await returnRequestService.triggerRefund({
      requestId: req.params.id,
      adminId,
      adminName,
    });
    response.status = 200;
    response.message = constants.returnMessage.REFUND_COMPLETED;
  } catch (error) {
    console.error('Controller: return.triggerRefund', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};

module.exports.closeReturn = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { note } = req.body;
    const adminId = req.adminUser._id;
    const adminName = req.adminUser.fullName;

    response.body = await returnRequestService.closeReturn({
      requestId: req.params.id,
      adminId,
      adminName,
      note,
    });
    response.status = 200;
    response.message = 'Return request closed';
  } catch (error) {
    console.error('Controller: return.closeReturn', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};
