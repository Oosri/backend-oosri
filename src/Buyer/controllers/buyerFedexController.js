const  fedexService  = require("../Service/buyerFedexService");
const constants = require('../constants');


module.exports.calculateShipping = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { origin, destination, weight } = req.body;
    
    const serviceResponse = await fedexService.getFedExRates(origin, destination, weight);

    response.status = 200;
    response.message = constants.shippingRateMessages.RETRIEVE_SHIPPING_RATE;
    response.body = serviceResponse;
  } catch (error) {
    console.error("FedEx Controller Error:", error.message);
    response.status = 500;
    response.message = "Failed to retrieve shipping rates";
  }
  return res.status(response.status).send(response);
};



