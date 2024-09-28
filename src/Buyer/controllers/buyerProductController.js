const buyerProductService = require('../Service/buyerProductService');
const constants = require('../constants');



module.exports.retrieveAllProducts = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
      const { skip = 0, limit = 10, category, color, brand, productName, minPrice, maxPrice, country, storage } = req.query;
      
      const serviceResponse = await buyerProductService.retrieveAllProducts({ 
          skip, 
          limit, 
          category, 
          color, 
          brand, 
          productName, 
          minPrice, 
          maxPrice, 
          country, 
          storage 
      });

      response.status = 200;
      response.message = constants.buyerProductMessage.PRODUCT_FETCHED;
      response.body = serviceResponse;
  } catch (error) {
      console.log('Something went wrong: Controller: retrieveAllProducts', error);
      response.status = 500;
      response.message = error.message;
  }
  return res.status(response.status).send(response);
};


  module.exports.retrieveProductById = async (req, res) => {
    let response = {...constants.customServerResponse }; 
    try {
      const serviceResponse = await buyerProductService.retrieveProductById(req.params);
      response.status = 200;
      response.message = constants.buyerProductMessage.PRODUCT_FETCHED;
      response.body = serviceResponse;
    } catch (error) {
      console.log('Something went wrong: Controller: getProductById', error);
      response.message = error.message;
    }
    return res.status(response.status).send(response);
  };

  module.exports.searchProducts = async (req, res) => {
    const response = { ...constants.customServerResponse };
    try {
        const { searchTerm, skip = 0, limit = 10 } = req.query;

        const searchResults = await buyerProductService.searchProducts(searchTerm, null, skip, limit);

        response.status = 200;
        response.message = constants.buyerProductMessage.PRODUCT_FETCHED;
        response.body = searchResults;
    } catch (error) {
        console.log('Something went wrong: Controller: searchProducts', error);
        response.message = error.message;
    }

    return res.status(response.status).json(response);
};

  

  module.exports.syncProductsToAlgolia = async  (req, res) =>{
    const response = { ...constants.customServerResponse };
    try {
        const syncResults = await buyerProductService.syncProductsToAlgolia();
        console.log('Synced products:', syncResults);
        response.status = 200;
        response.message = constants.buyerProductMessage.ALGOLIA_SYNC;
        response.body = syncResults;
    } catch (error) {
      console.log('Something went wrong: Controller: syncProducts', error);
    }
    return res.status(response.status).json(response);
};




  
