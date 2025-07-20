const adminSaleAnalyticsService = require('../services/adminSalesAnalyticsService');
const constants = require('../constants');


module.exports.retrieveOrderStat = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const serviceResponse = await adminSaleAnalyticsService.retrieveOrderStat();

    response.status = 200;
    response.message = constants.salesAnalyticsMessage.STATISTICS_FETCHED;
    response.body = serviceResponse;

  } catch (error) {
    console.log('Something went wrong: Controller: getOrderStatistics', error);
    response.message = error.message;
    response.status = 500;
  }

  return res.status(response.status).json(response);
};



module.exports.retrieveProductSalesAnalytics = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const filters = {
      dateFilter: req.query.dateFilter
    };

    const analytics = await adminSaleAnalyticsService.retrieveProductSalesAnalytics(filters);

    response.status = 200;
    response.message = constants.salesAnalyticsMessage.ANALYTICS_FETCHED;
    response.body = analytics;

  } catch (error) {
    console.log('Something went wrong: Controller: getProductSalesAnalytics', error);
    response.message = error.message;
    response.status = 500;
  }

  return res.status(response.status).json(response);
};


  

   