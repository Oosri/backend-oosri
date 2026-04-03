const buyerDHLService = require('../Service/buyerDHLService');
const buyerShippingService = require('../Service/buyerShippingService');
const shippingProviderService = require('../Service/shippingProviderService');
const constants = require('../constants');
const { getDHLPickupSchema, getDHLRateSchema } = require('../apiSchema/buyerDHLSchema');
const Buyer = require('../models/buyerAuthModel');
const { Product } = require('../../models/productModel');

module.exports.validateDHLAddress = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const { countryCode, cityName, postalCode } = req.body;

    const serviceResponse = await shippingProviderService.validateAddress({
      countryCode,
      cityName,
      postalCode,
    });

    response.status = 200;
    response.message = constants.shippingRateMessages.ADDRESS_VALIDATED;
    response.body = {
      provider: serviceResponse.provider,
      ...serviceResponse.response,
    };

    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Shipping Address Validation Controller Error:', error.message);
    response.status = 500;
    response.message = error.message || 'Address validation failed';
    return res.status(response.status).json(response);
  }
};

module.exports.getDHLRate = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const { error, value } = getDHLRateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        ...constants.customServerResponse,
        status: 400,
        message: error.message || 'Validation error'
      });
    }

<<<<<<< HEAD
    const { addressId, items, serviceType } = value;
=======
    const { addressId, items } = value;
>>>>>>> 1b652e5e60af23c891410e2aa18e8746d1331f32
    const productIds = items.map((item) => item.productId);

    const [buyer, products] = await Promise.all([
      Buyer.findOne(
        { 'deliveryAddresses._id': addressId },
        { 'deliveryAddresses.$': 1 }
      ),
      Product.find({ _id: { $in: productIds } }).lean()
    ]);

    if (!buyer) {
      return res.status(404).json({
        ...constants.customServerResponse,
        status: 404,
        message: 'Delivery address not found'
      });
    }

    const addressSubDoc = buyer.deliveryAddresses.id(addressId);
    if (!addressSubDoc) {
      return res.status(404).json({
        ...constants.customServerResponse,
        status: 404,
        message: 'Delivery address not found in buyer profile'
      });
    }

    const deliveryAddress = {
      address: addressSubDoc.address,
      postalCode: addressSubDoc.postalCode,
      cityName: addressSubDoc.cityName,
      countryCode: addressSubDoc.countryCode,
      countryName: addressSubDoc.countryName || addressSubDoc.regionName || addressSubDoc.stateName || addressSubDoc.countryCode
    };

    const productMap = new Map(products.map((product) => [product._id.toString(), product]));
    const sellerGroups = {};

    for (const item of items) {
      const product = productMap.get(item.productId.toString());
      if (!product) {
        return res.status(404).json({
          ...constants.customServerResponse,
          status: 404,
          message: `Product not found: ${item.productId}`
        });
      }

      const sellerId = product.seller ? product.seller.toString() : 'consolidated';
      if (!sellerGroups[sellerId]) {
        sellerGroups[sellerId] = {
          sellerId,
          items: []
        };
      }

      sellerGroups[sellerId].items.push({
        productId: item.productId,
        quantity: item.quantity
      });
    }

    const shippingQuote = await buyerShippingService.calculateConsolidatedShipping(
      deliveryAddress,
      Object.values(sellerGroups),
<<<<<<< HEAD
      products,
      { selectedServiceType: serviceType }
=======
      products
>>>>>>> 1b652e5e60af23c891410e2aa18e8746d1331f32
    );

    response.status = 200;
    response.message = constants.shippingRateMessages.RATE_RETRIEVED;
    response.body = shippingQuote;

    return res.status(response.status).json(response);
  } catch (error) {
    console.error('Shipping Get Rate Controller Error:', error.message);
<<<<<<< HEAD
    const isClientError = error.message.includes('Unable to calculate shipping fee') || error.message.includes('not found') || error.message.includes('Product not found');
    response.status = isClientError ? 400 : 500;
=======
    response.status = 500;
>>>>>>> 1b652e5e60af23c891410e2aa18e8746d1331f32
    response.message = error.message || 'Internal server error';
    return res.status(response.status).json(response);
  }
};

module.exports.scheduleDHLPickup = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const { error } = getDHLPickupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        status: 400,
        message: error.details[0].message,
        body: {},
      });
    }

    const serviceResponse = await buyerDHLService.schedulePickup(req.body);

    response.status = 200;
    response.message = constants.shippingRateMessages.PICKUP_SCHEDULED;
    response.body = serviceResponse;

    return res.status(response.status).json(response);
  } catch (error) {
    console.error('DHL Schedule Pickup Controller Error:', error.message);
    response.status = 500;
    response.message = error.message || 'Failed to schedule pickup';
    return res.status(response.status).json(response);
  }
};
