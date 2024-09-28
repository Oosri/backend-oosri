const productService = require('../Service/buyerProductService');
const constants = require('../constants');



module.exports.retrieveAllProducts = async (req, res) =>
  {
    let response = {...constants.customServerResponse }; 
    try {
      const serviceResponse = await productService.retrieveAllProducts(req.query);
        response.status = 200;
        response.message = constants.productMessage.PRODUCT_FETCHED;
        response.body = serviceResponse;
      
     
    } catch (error) {
      console.log('Something went wrong: Controller: createProduct', error);
      response.message = error.message;
    }
    return res.status(response.status).send(response);
  };

  module.exports.retrieveProductById = async (req, res) => {
    let response = {...constants.customServerResponse }; 
    try {
      const serviceResponse = await productService.retrieveProductById(req.params);
      response.status = 200;
      response.message = constants.productMessage.PRODUCT_FETCHED;
      response.body = serviceResponse;
    } catch (error) {
      console.log('Something went wrong: Controller: getProductById', error);
      response.message = error.message;
    }
    return res.status(response.status).send(response);
  };



  
