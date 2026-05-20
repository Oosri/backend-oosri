const adminSettingsService = require('../services/adminSettingsService');
const constants = require('../constants');

module.exports.getSettings = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const data = await adminSettingsService.getSettings();
    response.status  = 200;
    response.message = 'Settings fetched successfully';
    response.body    = data;
  } catch (error) {
    response.status  = 500;
    response.message = error.message || 'Failed to fetch settings';
  }
  return res.status(response.status).send(response);
};

module.exports.updateSettings = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const data = await adminSettingsService.updateSettings(req.body);
    response.status  = 200;
    response.message = 'Settings updated successfully';
    response.body    = data;
  } catch (error) {
    response.status  = 500;
    response.message = error.message || 'Failed to update settings';
  }
  return res.status(response.status).send(response);
};

module.exports.testShippingProvider = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { provider } = req.body;
    const data = await adminSettingsService.testShippingProvider(provider);
    response.status  = 200;
    response.message = 'Provider test completed';
    response.body    = data;
  } catch (error) {
    response.status  = error.message?.startsWith('Unknown') ? 400 : 500;
    response.message = error.message || 'Provider test failed';
  }
  return res.status(response.status).send(response);
};
