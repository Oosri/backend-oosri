const adminDashboardService = require('../services/adminDashboardService');
const constants = require('../constants');


module.exports.getDashboardSummary = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const serviceResponse = await adminDashboardService.getDashboardSummary();

    response.status = 200;
    response.message = constants.adminDashboardMessage.DASHBOARD_FETCHED;
    response.body = { dashboardSummary: serviceResponse };

  } catch (error) {
    console.error('Something went wrong: Controller: getDashboardSummary', error);
    response.message = error.message || constants.adminDashboardMessage.SUMMARY_FETCH_ERROR;
    response.status = 500;
  }
  return res.status(response.status).send(response);
};


module.exports.getDashboardSalesOverview = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const period = req.query.period || 'monthly';

    const validPeriods = ['daily', 'weekly', 'monthly', 'annually'];
    if (!validPeriods.includes(period)) {
        response.status = 400;
        response.message = `Invalid period specified. Use one of: ${validPeriods.join(', ')}.`;
        return res.status(response.status).send(response);
    }

    const serviceResponse = await adminDashboardService.getDashboardSalesOverview(period);

    response.status = 200;
    response.message = constants.adminDashboardMessage.DASHBOARD_FETCHED;
    response.body = { dashboardSalesOverview: serviceResponse };

  } catch (error) {
    console.error('Something went wrong: Controller: getDashboardSalesOverview', error);
    response.message = error.message || constants.adminDashboardMessage.OVERVIEW_FETCH_ERROR;
    response.status = 500;
  }
  return res.status(response.status).send(response);
};
