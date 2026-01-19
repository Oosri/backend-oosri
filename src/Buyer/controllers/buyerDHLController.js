const buyerDHLService = require('../Service/buyerDHLService');
const fxService = require('../Service/fxService');
const constants = require('../constants');
const { getDHLPickupSchema, getDHLRateSchema } = require('../apiSchema/buyerDHLSchema');
const Buyer = require('../models/buyerAuthModel');
const { Product } = require('../../models/productModel');
const redis = require('../../configs/redis');
const crypto = require('crypto');

const SHIPPER_DETAILS = {
  addressLine1: '3 Close B, Unity Estate Off Alkat way',
  cityName: 'Iju-Ishaga',
  postalCode: '100216',
  countyName: 'Lagos',
  countryCode: 'NG'
};

const DEFAULT_PACKAGE_SPECS = {
  WEIGHT: 0.5,
  LENGTH: 10,
  WIDTH: 10,
  HEIGHT: 5
};

const calculateShippingDate = () => {
  // Use Lagos timezone regardless of where the server is hosted
  const lagosDateStr = new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' });
  const date = new Date(lagosDateStr);
  let workingDaysAdded = 0;

  while (workingDaysAdded < 2) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    // 0 is Sunday, 6 is Saturday
    if (day !== 0 && day !== 6) {
      workingDaysAdded++;
    }
  }

  const pad = (n) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}GMT+01:00`;
};

module.exports.validateDHLAddress = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const { countryCode, cityName, postalCode } = req.body;

    const serviceResponse = await buyerDHLService.validateAddress({
      countryCode,
      cityName,
      postalCode: postalCode
    });

    response.status = 200;
    response.message = constants.shippingRateMessages.ADDRESS_VALIDATED;
    response.body = serviceResponse;

    return res.status(response.status).json(response);
  } catch (error) {
    console.error('DHL Address Validation Controller Error:', error.message);
  }
  return res.status(response.status).send(response);
};


module.exports.getDHLRate = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    // 1. IMPROVED VALIDATION: Use Joi schema
    const { error, value } = getDHLRateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        ...constants.customServerResponse,
        status: 400,
        message: error.message || 'Validation error'
      });
    }

    const { addressId, items } = value;
    const plannedShippingDateAndTime = value.plannedShippingDateAndTime || calculateShippingDate();

    // OPTIMIZATION 1: Parallel Database Queries with Projection
    const productIds = items.map(item => item.productId);
    const [buyer, products] = await Promise.all([
      Buyer.findOne(
        { 'deliveryAddresses._id': addressId },
        { 'deliveryAddresses.$': 1 } // Only return the matching address subdoc
      ),
      Product.find({ _id: { $in: productIds } })
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

    // OPTIMIZATION 2: Address Normalization for DHL Compatibility
    const normalizedCityName = normalizeCityForDHL(addressSubDoc.cityName, addressSubDoc.countryCode);

    const receiverDetails = {
      postalCode: addressSubDoc.postalCode,
      cityName: normalizedCityName,
      countryCode: addressSubDoc.countryCode,
      addressLine1: addressSubDoc.address || ''
    };

    // FIX: Map available field to countyName (region/state)
    if (addressSubDoc.regionName || addressSubDoc.stateName) {
      receiverDetails.countyName = addressSubDoc.regionName || addressSubDoc.stateName;
    }

    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    // OPTIMIZATION: 3D Volumetric Package Consolidation
    const packages = [];
    const MAX_PACKAGE_WEIGHT = 70; // kg
    const MAX_PACKAGE_VOLUME = 250000; // cm³ (e.g., 50x50x100cm)

    let currentPackageWeight = 0;
    let currentPackageVolume = 0;
    let currentMaxL = 0, currentMaxW = 0, currentMaxH = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return res.status(404).json({
          ...constants.customServerResponse,
          status: 404,
          message: `Product not found: ${item.productId}`
        });
      }

      const unitWeight = parseFloat(product.weight) || DEFAULT_PACKAGE_SPECS.WEIGHT;
      const length = product.dimensions?.length || DEFAULT_PACKAGE_SPECS.LENGTH;
      const width = product.dimensions?.width || DEFAULT_PACKAGE_SPECS.WIDTH;
      const height = product.dimensions?.height || DEFAULT_PACKAGE_SPECS.HEIGHT;
      const unitVolume = length * width * height;

      let remainingQuantity = item.quantity;

      while (remainingQuantity > 0) {
        const availableWeight = MAX_PACKAGE_WEIGHT - currentPackageWeight;
        const availableVolume = MAX_PACKAGE_VOLUME - currentPackageVolume;

        const canFitWeight = Math.floor(availableWeight / unitWeight);
        const canFitVolume = Math.floor(availableVolume / unitVolume);
        const canFit = Math.min(canFitWeight, canFitVolume);

        if (canFit > 0) {
          const unitsToPack = Math.min(canFit, remainingQuantity);
          currentPackageWeight += (unitsToPack * unitWeight);
          currentPackageVolume += (unitsToPack * unitVolume);
          currentMaxL = Math.max(currentMaxL, length);
          currentMaxW = Math.max(currentMaxW, width);
          currentMaxH = Math.max(currentMaxH, height);
          remainingQuantity -= unitsToPack;
        }

        // If package is full OR we are at the end of items and this package has data
        if (canFit === 0 || (remainingQuantity === 0 && item === items[items.length - 1])) {
          if (currentPackageWeight > 0) {
            packages.push({
              weight: Number(currentPackageWeight.toFixed(2)),
              dimensions: {
                length: currentMaxL || length,
                width: currentMaxW || width,
                height: currentMaxH || height
              }
            });
            currentPackageWeight = 0;
            currentPackageVolume = 0;
            currentMaxL = 0; currentMaxW = 0; currentMaxH = 0;
          }

          // If the item itself is bigger than a single box (rare but possible)
          if (canFit === 0 && (unitWeight > MAX_PACKAGE_WEIGHT || unitVolume > MAX_PACKAGE_VOLUME)) {
            packages.push({
              weight: unitWeight,
              dimensions: { length, width, height }
            });
            remainingQuantity--;
          }
        }
      }
    }

    if (packages.length === 0) {
      response.status = 400;
      response.message = 'Failed to generate packages';
      return res.status(response.status).json(response);
    }

    // Normalize shipper address
    const normalizedShipperDetails = {
      ...SHIPPER_DETAILS,
      cityName: normalizeCityForDHL(SHIPPER_DETAILS.cityName, SHIPPER_DETAILS.countryCode)
    };

    // OPTIMIZATION 3: Redis Cache (10 min TTL)
    const cacheKey = generateRateCacheKey(normalizedShipperDetails, receiverDetails, packages);
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        console.log('✅ Cache hit for DHL rate');
        response.status = 200;
        response.message = constants.shippingRateMessages.RATE_RETRIEVED;
        response.body = JSON.parse(cachedData);
        return res.status(response.status).json(response);
      }
    } catch (cacheError) {
      console.warn('Cache read error:', cacheError.message);
    }

    const serviceResponse = await buyerDHLService.getDeliveryRate({
      plannedShippingDateAndTime,
      shipperDetails: normalizedShipperDetails,
      receiverDetails,
      packages,
    });

    const USD_SURCHARGE = 1.5;
    let ngnToUsdRate = null;

    if (serviceResponse.currency === 'NGN' && serviceResponse.totalPrice) {
      try {
        ngnToUsdRate = await fxService.getFxRateNGNtoUSD();
        const usdPrice = serviceResponse.totalPrice * ngnToUsdRate;
        serviceResponse.totalPriceUSD = Number((usdPrice + USD_SURCHARGE).toFixed(2));

        // Update exchangeRate to reflect From -> USD if it was From -> NGN
        if (serviceResponse.exchangeRate && serviceResponse.exchangeRate.to === 'NGN') {
          const { from, rate } = serviceResponse.exchangeRate;
          // If 1 NGN = [rate] [from], and 1 NGN = [ngnToUsdRate] USD
          // Then [rate] [from] = [ngnToUsdRate] USD
          // So 1 [from] = [ngnToUsdRate] / [rate] USD
          serviceResponse.exchangeRate = {
            from: from,
            to: 'USD',
            rate: Number((ngnToUsdRate / rate).toFixed(6))
          };
        }
      } catch (error) {
        console.error('Failed to convert delivery fee to USD:', error.message);
      }
    } else if (serviceResponse.currency === 'USD') {
      serviceResponse.totalPriceUSD = Number((serviceResponse.totalPrice + USD_SURCHARGE).toFixed(2));
    } else if (serviceResponse.currency && serviceResponse.totalPrice) {
      console.warn(`Untracked currency for USD conversion: ${serviceResponse.currency}`);
    }

    // Cache the successful response
    try {
      await redis.set(cacheKey, JSON.stringify(serviceResponse), 'EX', 600); // 10 minutes
    } catch (cacheWriteError) {
      console.warn('Cache write error:', cacheWriteError.message);
    }

    response.status = 200;
    response.message = constants.shippingRateMessages.RATE_RETRIEVED;
    response.body = serviceResponse;

    return res.status(response.status).json(response);

  } catch (error) {
    console.error('DHL Get Rate Controller Error:', error.message);
    response.status = 500;
    response.message = error.message || 'Internal server error';
    return res.status(response.status).json(response);
  }
};

// ==================== HELPER FUNCTIONS ====================

// HELPER: Normalize city names for DHL API compatibility
function normalizeCityForDHL(cityName, countryCode) {
  if (countryCode !== 'NG') {
    return cityName; // Only normalize Nigerian addresses
  }

  const normalizedCity = cityName.toLowerCase().trim();

  // Map of granular localities to DHL-recognized cities
  const lagosSuburbs = [
    'iju-ishaga', 'iju', 'ishaga', 'agege', 'alimosho',
    'amuwo-odofin', 'apapa', 'badagry', 'epe', 'eti-osa',
    'ibeju-lekki', 'ifako-ijaiye', 'kosofe', 'mushin',
    'oshodi-isolo', 'shomolu', 'surulere', 'victoria island',
    'lekki', 'ajah', 'ikoyi', 'yaba', 'ikeja'
  ];

  // If it's a Lagos suburb, use "Lagos" for DHL
  if (lagosSuburbs.some(suburb => normalizedCity.includes(suburb))) {
    return 'Lagos';
  }

  // Return original if no normalization needed
  return cityName;
}

// HELPER: Generate cache key with MD5 hashing for efficiency
function generateRateCacheKey(shipper, receiver, packages) {
  const packageStr = packages.map(p =>
    `${p.weight}-${p.dimensions.length}x${p.dimensions.width}x${p.dimensions.height}`
  ).sort().join('|');

  const packageHash = crypto.createHash('md5').update(packageStr).digest('hex');

  return `dhl:rate:${shipper.countryCode}:${shipper.postalCode}:${receiver.countryCode}:${receiver.postalCode}:${packageHash}`;
}

// ==================== END HELPER FUNCTIONS ====================

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
    console.error('DHL Schedule Pickup Controller Error :', error.message);
    response.status = 500;
    response.message = error.message || 'Failed to schedule pickup';
    return res.status(response.status).json(response);
  }
};