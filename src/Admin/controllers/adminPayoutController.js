const adminPayoutService = require('../services/adminPayoutService');
const constants = require('../constants');

module.exports.getPayouts = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const data = await adminPayoutService.getPayouts({ page, limit, status });
    response.status  = 200;
    response.message = 'Payouts fetched successfully';
    response.body    = data;
  } catch (error) {
    response.status  = 500;
    response.message = error.message || 'Failed to fetch payouts';
  }
  return res.status(response.status).send(response);
};

module.exports.approvePayout = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { payoutId } = req.params;
    const data = await adminPayoutService.approvePayout(payoutId);
    response.status  = 200;
    response.message = 'Payout approved successfully';
    response.body    = data;
  } catch (error) {
    response.status  = error.message === 'Payout not found' ? 404 : 500;
    response.message = error.message || 'Failed to approve payout';
  }
  return res.status(response.status).send(response);
};

module.exports.rejectPayout = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { payoutId } = req.params;
    const data = await adminPayoutService.rejectPayout(payoutId);
    response.status  = 200;
    response.message = 'Payout rejected successfully';
    response.body    = data;
  } catch (error) {
    response.status  = error.message === 'Payout not found' ? 404 : 500;
    response.message = error.message || 'Failed to reject payout';
  }
  return res.status(response.status).send(response);
};
