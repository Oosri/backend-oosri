const adminProductService = require('../services/adminProductService');
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
    console.error('Something went wrong: Controller: getAllProducts', error);
    response.status = 500;
    response.message =
      error.message || constants.adminProductMessage.PRODUCT_FETCH_ERROR;
  }
  return res.status(response.status).send(response);
};

module.exports.approveProduct = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { productId } = req.params;

    const serviceResponse = await adminProductService.approveProduct(productId);

    if (serviceResponse === 'approve') {
      response.status = 200;
      response.message = constants.adminProductMessage.PRODUCT_APPROVED;
      response.body = serviceResponse;
    } else if (serviceResponse === 'reject') {
      response.status = 204;
      response.message = constants.adminProductMessage.PRODUCT_REJECTED;
    } else {
      response.status = 400;
      response.message = constants.adminProductMessage.PRODUCT_ACTION;
    }
  } catch (error) {
    console.error('Something went wrong: Controller: approveProduct', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.getProductById = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { productId } = req.params;
    const serviceResponse = await adminProductService.getProductById(productId);

    response.status = 200;
    response.message = constants.adminProductMessage.PRODUCT_FETCHED_BY_ID;
    response.body = serviceResponse;
  } catch (error) {
    console.error('Something went wrong: Controller: getProductById', error);
    if (
      error.message === constants.adminProductMessage.PRODUCT_NOT_FOUND ||
      error.message === constants.databaseMessage.INVALID_ID
    ) {
      response.status = 404;
    } else {
      response.status = 500;
    }
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.deleteProduct = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { productId } = req.params;
    await adminProductService.deleteProduct(productId);

    response.status = 204;
    response.message = constants.adminProductMessage.PRODUCT_REMOVED;
    response.body = {};
  } catch (error) {
    console.error('Something went wrong: Controller: deleteProduct', error);
    if (
      error.message === constants.adminProductMessage.PRODUCT_NOT_FOUND ||
      error.message === constants.databaseMessage.INVALID_ID
    ) {
      response.status = 404;
    } else {
      response.status = 500;
    }
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.filterProducts = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const {
      category,
      subcategory,
      brandArtist,
      minPrice,
      maxPrice,
      keyword,
      sortBy,
      productStatus,
      isApproved,
      page,
      limit
    } = req.query;

    const filters = {
      category,
      subcategory,
      brandArtist,
      minPrice,
      maxPrice,
      keyword,
      sortBy,
      productStatus,
      isApproved,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10
    };

    const result = await adminProductService.filterProducts(filters);

    response.status = 200;
    response.message = constants.adminProductMessage.PRODUCT_FETCHED;
    response.body = {
      products: result.products,
      pagination: result.pagination
    };
  } catch (error) {
    console.error('Something went wrong: Controller: filterProducts', error);
    response.status = 500;
    response.message =
      error.message || constants.adminProductMessage.PRODUCT_FETCH_ERROR;
  }
  return res.status(response.status).send(response);
};

module.exports.updateProduct = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { productId } = req.params;
    const updated = await adminProductService.updateProduct(productId, req.body);
    response.status = 200;
    response.message = constants.adminProductMessage.PRODUCT_UPDATED || 'Product updated successfully';
    response.body = updated;
  } catch (error) {
    console.error('Something went wrong: Controller: updateProduct', error);
    if (
      error.message === constants.adminProductMessage.PRODUCT_NOT_FOUND ||
      error.message === constants.databaseMessage.INVALID_ID
    ) {
      response.status = 404;
    } else {
      response.status = 500;
    }
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.toggleProductVisibility = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { productId } = req.params;
    const { isVisible } = req.body;

    const serviceResponse = await adminProductService.toggleProductVisibility({
      productId,
      isVisible
    });

    response.status = 200;
    response.message = constants.adminProductMessage.PRODUCT_VISIBLE_UPDATED;
    response.body = serviceResponse;
  } catch (error) {
    console.error(
      'Something went wrong: Controller: toggleProductVisibility',
      error
    );
    response.status = 500;
    response.message =
      error.message || constants.adminProductMessage.PRODUCT_VISIBLE_ERROR;
  }
  return res.status(response.status).send(response);
};
