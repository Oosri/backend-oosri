const buyerProductReviewService = require('../Service/buyerProductReviewService');
const constants = require('../constants');

module.exports.addProductReview = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const userId = req.user.id;  
    const serviceData = {
      ...req.body,
      userId 
    };
    
    const serviceResponse = await buyerProductReviewService.addProductReview(serviceData);
    
    response.status = 201;
    response.message = constants.reviewMessage.REVIEW_CREATED;
    response.body = serviceResponse;
  } catch (error) {
    console.log('Something went wrong: Controller: addProductReview', error);
    response.message = error.message;
  }
  
  return res.status(response.status).send(response);
};


module.exports.retrieveProductsReview = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { productId } = req.params; 
    
    const serviceResponse = await buyerProductReviewService.retrieveProductsReview(productId);

    if (serviceResponse.length === 0) {
      response.status = 200;
      response.message = constants.reviewMessage.REVIEW_NOT_FOUND;
    } else {
      response.status = 200;
      response.message = constants.reviewMessage.REVIEW_FETCHED;
      response.body = serviceResponse;
    }
  } catch (error) {
    console.log('Something went wrong: Controller: retrieveProductsReview', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};


module.exports.retrieveProductReviewById = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { id } = req.params;
    const serviceResponse = await buyerProductReviewService.retrieveProductReviewById({ id });
    
      response.status = 200;
      response.message = constants.reviewMessage.REVIEW_FETCHED;
      response.body = serviceResponse;
    
  } catch (error) {
    console.log('Something went wrong: Controller: retrieveProductReviewById', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};


module.exports.retrieveProductReviewsByBuyerId = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const userId = req.user.id; 
    const serviceResponse = await buyerProductReviewService.retrieveProductReviewsByBuyerId({ userId });
    if(serviceResponse.length ===0)
      {
        response.status = 200;
        response.message = constants.reviewMessage.REVIEW_NOT_FOUND;
      }
    else{
      response.status = 200;
    response.message = constants.reviewMessage.REVIEW_FETCHED;
      response.body = serviceResponse;
    }
  } catch (error) {
    console.log('Something went wrong: Controller: retrieveProductReviewsByUserId', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};



module.exports.removeProductReview = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const userId = req.user.id; 
    const serviceResponse = await buyerProductReviewService.removeProductReview({
      id: req.params.id,
      userId: userId
    });
      response.status = 200;
      response.message = constants.reviewMessage.REVIEW_REMOVED;
      response.body = serviceResponse;
    
  } catch (error) {
    console.log('Something went wrong: Controller: removeProductReview', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};