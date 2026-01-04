const buyerDHLService = require('../Service/buyerDHLService');
const constants = require('../constants');
const { getDHLPickupSchema } = require('../apiSchema/buyerDHLSchema');

module.exports.validateDHLAddress = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const { countryCode, cityName, postalCode } = req.body;

    const serviceResponse = await buyerDHLService.validateAddress({
      countryCode,
      cityName,
      postalCode: postalCode
    });

    response.status = 200;
    response.message = constants.shippingRateMessages.ADDRESS_VALIDATED;
    response.body = serviceResponse;

    return res.status(response.status).json(response);
  } catch (error) {
    console.error('DHL Address Validation Controller Error:', error.message);
  }
    return res.status(response.status).send(response);
};
module.exports.getDHLRate = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const {
      plannedShippingDateAndTime,
      shipperDetails,
      receiverDetails,
      packages,
    } = req.body;

    if (!Array.isArray(packages) || packages.length === 0) {
      response.status = 400;
      response.message = 'Packages must be a non-empty array';
      return res.status(response.status).json(response);
    }

    const serviceResponse = await buyerDHLService.getDeliveryRate({
      plannedShippingDateAndTime,
      shipperDetails,
      receiverDetails,
      packages,
    });

    response.status = 200;
    response.message = constants.shippingRateMessages.RATE_RETRIEVED;
    response.body = serviceResponse;

    return res.status(response.status).json(response);

  } catch (error) {
    console.error('DHL Get Rate Controller Error:', error.message);
    response.status = 500;
    response.message = error.message || 'Failed to retrieve DHL rate';
    return res.status(response.status).json(response);
  }
};


module.exports.scheduleDHLPickup = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const { error } = getDHLPickupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: 400,
        message: error.details[0].message,
        body: {},
      });
    }

    const serviceResponse = await buyerDHLService.schedulePickup(req.body);

    response.status = 200;
    response.message = constants.shippingRateMessages.PICKUP_SCHEDULED;
    response.body = serviceResponse;

    return res.status(response.status).json(response);
  } catch (error) {
     console.error('DHL Schedule Pickup Controller Error :', error.message);
    response.status = 500;
    response.message = error.message || 'Failed to schedule pickup';
    return res.status(response.status).json(response);
  }
};