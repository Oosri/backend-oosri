const buyerCartService = require('../../Buyer/Service/buyerCartService');
const constants = require('../constants');


module.exports.generateUniqueCartKey = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const serviceResponse = await buyerCartService.generateUniqueCartKey();
    response.status = 200;
    response.message = constants.CartMessage.CART_KEY_GENERATED;
    response.body = { cartKey: serviceResponse };
  } catch (error) {
    console.log('Something went wrong: Controller: generateCartKey', error);
    response.status = 500;
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.addToCart = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const serviceResponse = await buyerCartService.addToCart({
      userId: req.user ? req.user.id : null,
      cartKey: req.body.cartKey,
      items: req.body.items
    });

    response.status = 201;
    response.message = constants.CartMessage.CART_CREATED;
    response.body = serviceResponse;
  } catch (error) {
    console.log('Something went wrong: Controller: addToCart', error);
    response.message = error.message;
  }

  return res.status(response.status).send(response);
};


module.exports.retrieveUserCart = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const userId = req.user ? req.user.id : null;
    const cartKey = req.query.cartKey || null;


    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const serviceResponse = await buyerCartService.retrieveUserCart({ userId, cartKey, page, limit });

    if (serviceResponse.cartItems.length === 0) {
      response.status = 200;
      response.message = constants.CartMessage.EMPTY_CART;
    } else {
      response.status = 200;
      response.message = constants.CartMessage.CART_FETCHED;
      response.body = serviceResponse;
    }

  } catch (error) {
    console.log('Something went wrong: Controller: retrieveUserCart', error);
    response.status = 500;
    response.message = error.message;
  }

  return res.status(response.status).json(response);
};


module.exports.mergeCarts = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const userId = req.user.id;
    const cartKey = req.body.cartKey;

    if (!cartKey) {
      throw new Error(constants.CartMessage.INVALID_CART_KEY);
    }
    const mergedCart = await buyerCartService.mergeCarts(userId, cartKey);
    response.status = 200;
    response.message = constants.CartMessage.CART_MERGED;
    response.body = mergedCart;

  } catch (error) {
    console.log('Something went wrong: Controller: mergeCarts', error);
    response.message = error.message;
    response.status = 500;
  }
  return res.status(response.status).send(response);
};


module.exports.removeUserCartItem = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const productId = req.params.id;
    const userId = req.user ? req.user.id : null;
    const cartKey = req.query.cartKey || null;


    const serviceResponse = await buyerCartService.removeUserCartItem(productId, userId, cartKey);

    response.status = 200;
    response.message = constants.CartMessage.CART_REMOVED;
    response.body = serviceResponse;
  } catch (error) {
    console.log('Something went wrong: Controller: removeUserCartItem', error);
    response.status = 500;
    response.message = error.message;
  }

  return res.status(response.status).send(response);
};

