const constants = require('../constants');
const buyerContactUsService = require('../Service/buyerContactUsService');


module.exports.contactUs = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const serviceResponse = await buyerContactUsService.contactUs(req.body);
    response.status = 200;
    response.message = constants.buyerContactUsMessage.SUCCESS;
    response.body = serviceResponse;
  } catch (error) {
    console.log('Something went wrong: Controller: ContactUs', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
}

