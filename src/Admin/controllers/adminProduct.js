const adminProductService = require('../services/adminProduct');
const constants = require('../constants');

module.exports.getAllProducts = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
      const { category, subcategory, page = 1, limit = 10 } = req.query;
      
      const serviceResponse = await adminProductService.getAllProducts({ 
          category,
          subcategory,
          page,
          limit 
      });

      response.status = 200;
      response.message = constants.adminProductMessage.PRODUCT_FETCHED;
      response.body = serviceResponse;
  } catch (error) {
      console.log('Something went wrong: Controller: getAllProducts', error);
      response.status = 500;
      response.message = error.message;
  }
  return res.status(response.status).send(response);
};