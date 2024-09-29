const buyerCartService = require('../../Buyer/Service/buyerCartService');
const constants = require('../constants');
const { v4: uuidv4 } = require('uuid');

module.exports.generateCartKey = (req, res, next) => {
  if (!req.cookies.cartKey) {
    const cartKey = uuidv4(); 
    res.cookie('cartKey', cartKey, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true }); 
    req.cartKey = cartKey; 
  } else {
    req.cartKey = req.cookies.cartKey; 
  }
  next();
};

module.exports.addToCart = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const serviceResponse = await buyerCartService.addToCart({
      user: req.user ? req.user.id : null, 
      cartKey: req.cartKey, 
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
    const cartKey = req.cookies.cartKey || req.cartKey;  

    const serviceResponse = await buyerCartService.retrieveUserCart({ 
      userId: req.user ? req.user.id : null,  
      cartKey: cartKey  
    });

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
    const cartKey = req.cookies.cartKey || req.body.cartKey; 

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



module.exports. removeUserCart = async (req, res) => {
  let response = { ...constants.customServerResponse }; 
  try {
    const serviceResponse = await buyerCartService.removeUserCart(req.params.id);
    response.status = 200;
    response.message = constants.CartMessage.CART_REMOVED;
    response.body = serviceResponse;
  } catch (error) {
    console.log('Something went wrong: Controller: removeUserCart', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};