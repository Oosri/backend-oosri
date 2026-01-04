const buyerSavedItemsService = require('../../Buyer/Service/buyerSavedItemsService');
const constants = require('../constants');

module.exports.buyerSavedItems  = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const serviceResponse = await buyerSavedItemsService.buyerSavedItems({
      userId: req.user.id,  
      productId: req.body.productId  
    });
    response.status = 201;
    response.message = constants.buyerSavedItemsMessage.BUYER_SAVED_ITEM_CREATED;
    response.body = serviceResponse;
  } catch (error) {
    console.log('Something went wrong: Controller: buyerSavedItems', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};




module.exports.retrieveBuyerSavedItems = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const userId = req.user.id;
    const serviceResponse = await buyerSavedItemsService.retrieveBuyerSavedItems(userId);
    if (serviceResponse.length === 0) {
      response.status = 200;
      response.message = constants.buyerSavedItemsMessage.BUYER_EMPTY_SAVED_ITEM;
    } else {
      response.status = 200;
      response.message = constants.buyerSavedItemsMessage.BUYER_SAVED_ITEM_FETCHED;
      response.body = serviceResponse;
    }
  } catch (error) {
    console.log('Something went wrong: Controller: retrieveBuyerSavedItems', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};




module.exports.removeBuyerSavedItems = async (req, res) => {
  const response = { ...constants.customServerResponse };
  try {
    const userId = req.user.id;
    const productId = req.params.productId;
    const serviceResponse = await buyerSavedItemsService.removeBuyerSavedItems(userId, productId);
    response.status = 200;
    response.message = constants.buyerSavedItemsMessage.BUYER_SAVED_ITEM_REMOVED;
    response.body = serviceResponse;
  } catch (error) {
    console.log('Something went wrong: Controller: removeBuyerSavedItems', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};


