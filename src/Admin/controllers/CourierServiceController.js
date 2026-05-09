const courierService = require('../services/CourierService');
const constants = require('../constants');



module.exports.createCourierService = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { name } = req.body;
    const file = req.file;

    if (!file) {
      response.status = 400;
      response.message = constants.courierServiceMessage.IMAGE_REQUIRED;
      return res.status(response.status).send(response);
    }

    const serviceResponse = await courierService.createCourierService({
      name,
      fileBuffer: file.buffer,
      originalName: file.originalname,
    });

    response.status = 201;
    response.message = constants.courierServiceMessage.COURIER_CREATED;
    response.body = serviceResponse;
  } catch (error) {
    console.error('Something went wrong: Controller: createCourierService', error);
    response.status = 500;
    response.message =
      error.message || constants.courierServiceMessage.COURIER_CREATE_ERROR;
  }
  return res.status(response.status).send(response);
};

module.exports.retrieveAllCourierServices = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const serviceResponse = await courierService.retrieveAllCourierServices();

    response.status = 200;
    response.message = constants.courierServiceMessage.COURIER_FETCHED;
    response.body = serviceResponse;
  } catch (error) {
    console.error('Something went wrong: Controller: retrieveAllCourierServices', error);
    response.status = 500;
    response.message =
      error.message || constants.courierServiceMessage.COURIER_FETCH_ERROR;
  }
  return res.status(response.status).send(response);
};
