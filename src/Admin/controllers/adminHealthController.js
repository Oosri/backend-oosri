const adminHealthService = require('../services/adminHealthService');
const constants = require('../constants');

module.exports.checkHealth = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const data = await adminHealthService.checkAll();
    response.status  = 200;
    response.message = 'Health check completed';
    response.body    = data;
  } catch (error) {
    response.status  = 500;
    response.message = error.message || 'Health check failed';
  }
  return res.status(response.status).send(response);
};
