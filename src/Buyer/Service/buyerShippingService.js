const buyerDHLService = require('./buyerDHLService');
const fxService = require('./fxService');
const { Product } = require('../../models/productModel');

// Constants from buyerDHLController
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

// Simple in-memory cache (shared with controller)
const shippingCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Calculate shipping date (2 working days from now)
 */
const calculateShippingDate = () => {
    let date = new Date();
    let workingDaysAdded = 0;

    while (workingDaysAdded < 2) {
        date.setDate(date.getDate() + 1);
        const day = date.getDay();
        if (day !== 0 && day !== 6) {
            workingDaysAdded++;
        }
    }

    const isoString = date.toISOString().split('.')[0];
    return `${isoString}GMT+01:00`;
};

/**
 * Normalize city names for DHL API compatibility
 */
function normalizeCityForDHL(cityName, countryCode) {
    if (countryCode !== 'NG') {
        return cityName;
    }

    const normalizedCity = cityName.toLowerCase().trim();

    const lagosSuburbs = [
        'iju-ishaga', 'iju', 'ishaga', 'agege', 'alimosho',
        'amuwo-odofin', 'apapa', 'badagry', 'epe', 'eti-osa',
        'ibeju-lekki', 'ifako-ijaiye', 'kosofe', 'mushin',
        'oshodi-isolo', 'shomolu', 'surulere', 'victoria island',
        'lekki', 'ajah', 'ikoyi', 'yaba', 'ikeja'
    ];

    if (lagosSuburbs.some(suburb => normalizedCity.includes(suburb))) {
        return 'Lagos';
    }

    return cityName;
}

/**
 * Generate cache key for shipping rate lookup
 */
function generateShippingCacheKey(shipper, receiver, packages) {
    const packageHash = packages.map(p =>
        `${p.weight}-${p.dimensions.length}x${p.dimensions.width}x${p.dimensions.height}`
    ).sort().join('|');

    return `shipping:${shipper.countryCode}:${shipper.postalCode}:${receiver.countryCode}:${receiver.postalCode}:${packageHash}`;
}

/**
 * Get cached shipping rate
 */
function getCachedShippingRate(key) {
    const cached = shippingCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
        shippingCache.delete(key);
        return null;
    }

    return cached.data;
}

/**
 * Cache shipping rate
 */
function cacheShippingRate(key, data) {
    shippingCache.set(key, {
        data,
        timestamp: Date.now()
    });

    // Cleanup old entries
    if (shippingCache.size > 1000) {
        const now = Date.now();
        for (const [k, v] of shippingCache.entries()) {
            if (now - v.timestamp > CACHE_TTL_MS) {
                shippingCache.delete(k);
            }
        }
    }
}

/**
 * Get last successful shipping rate from cache (for fallback resilience)
 */
function getLastSuccessfulRate(receiverCountryCode, receiverPostalCode) {
    // Find any cached rate for the same destination
    for (const [key, value] of shippingCache.entries()) {
        if (key.includes(receiverCountryCode) && key.includes(receiverPostalCode)) {
            if (Date.now() - value.timestamp <= CACHE_TTL_MS) {
                console.log(`[FALLBACK] Using cached rate for ${receiverCountryCode}:${receiverPostalCode}`);
                return value.data;
            }
        }
    }
    return null;
}

/**
 * Calculate consolidated shipping fee for all items in an order
 * 
 * @param {Object} deliveryAddress - Buyer's delivery address
 * @param {Array} sellers - Array of seller objects with items
 * @param {Array} products - Pre-fetched product documents (optional, will fetch if not provided)
 * @returns {Object} { totalPriceUSD, totalPriceNGN, currency, provider, cached }
 */
module.exports.calculateConsolidatedShipping = async (deliveryAddress, sellers, products = null) => {
    try {
        const plannedShippingDateAndTime = calculateShippingDate();

        // Fetch products if not provided
        let productMap;
        if (products && Array.isArray(products)) {
            productMap = new Map(products.map(p => [p._id.toString(), p]));
        } else {
            const productIds = sellers.flatMap(s => s.items.map(i => i.productId));
            const fetchedProducts = await Product.find({ _id: { $in: productIds } }).lean();
            productMap = new Map(fetchedProducts.map(p => [p._id.toString(), p]));
        }

        // Normalize receiver address
        const normalizedReceiverDetails = {
            postalCode: deliveryAddress.postalCode,
            cityName: normalizeCityForDHL(deliveryAddress.cityName, deliveryAddress.countryCode),
            countryCode: deliveryAddress.countryCode,
            addressLine1: deliveryAddress.address || deliveryAddress.addressLine1 || ''
        };

        if (deliveryAddress.countryName) {
            normalizedReceiverDetails.countyName = deliveryAddress.countryName;
        }

        // Build consolidated packages from all sellers
        const packages = [];
        const MAX_PACKAGE_WEIGHT = 70; // DHL max weight per package (kg)

        for (const seller of sellers) {
            for (const item of seller.items) {
                const product = productMap.get(item.productId.toString());
                if (!product) {
                    throw new Error(`Product not found: ${item.productId}`);
                }

                const unitWeight = parseFloat(product.weight) || DEFAULT_PACKAGE_SPECS.WEIGHT;
                const length = product.dimensions?.length || DEFAULT_PACKAGE_SPECS.LENGTH;
                const width = product.dimensions?.width || DEFAULT_PACKAGE_SPECS.WIDTH;
                const height = product.dimensions?.height || DEFAULT_PACKAGE_SPECS.HEIGHT;

                const totalWeight = unitWeight * item.quantity;

                if (totalWeight <= MAX_PACKAGE_WEIGHT) {
                    packages.push({
                        weight: totalWeight,
                        dimensions: { length, width, height }
                    });
                } else {
                    // Split into multiple packages
                    let remainingQuantity = item.quantity;
                    const unitsPerPackage = Math.floor(MAX_PACKAGE_WEIGHT / unitWeight);

                    while (remainingQuantity > 0) {
                        const unitsInThisPackage = Math.min(unitsPerPackage, remainingQuantity);
                        packages.push({
                            weight: unitWeight * unitsInThisPackage,
                            dimensions: { length, width, height }
                        });
                        remainingQuantity -= unitsInThisPackage;
                    }
                }
            }
        }

        if (packages.length === 0) {
            throw new Error('No packages to ship');
        }

        // Normalize shipper address
        const normalizedShipperDetails = {
            ...SHIPPER_DETAILS,
            cityName: normalizeCityForDHL(SHIPPER_DETAILS.cityName, SHIPPER_DETAILS.countryCode)
        };

        // Check cache first
        const cacheKey = generateShippingCacheKey(normalizedShipperDetails, normalizedReceiverDetails, packages);
        const cachedRate = getCachedShippingRate(cacheKey);

        if (cachedRate) {
            console.log('✅ Cache hit for shipping calculation');
            return {
                ...cachedRate,
                cached: true
            };
        }

        // Call DHL API with resilience
        let serviceResponse;
        try {
            serviceResponse = await buyerDHLService.getDeliveryRate({
                plannedShippingDateAndTime,
                shipperDetails: normalizedShipperDetails,
                receiverDetails: normalizedReceiverDetails,
                packages,
            });

            // Convert to USD if needed
            if (serviceResponse.currency === 'NGN' && serviceResponse.totalPrice) {
                try {
                    const usdPrice = await fxService.convertNGNtoUSD(serviceResponse.totalPrice);
                    serviceResponse.totalPriceUSD = Number((usdPrice + 1.5).toFixed(2));
                } catch (error) {
                    console.error('Failed to convert shipping fee to USD:', error.message);
                    // Use a reasonable fallback conversion rate if FX service fails
                    serviceResponse.totalPriceUSD = Number((serviceResponse.totalPrice / 1500).toFixed(2));
                }
            }

            // Cache the successful response
            const shippingResult = {
                totalPriceUSD: serviceResponse.totalPriceUSD || 0,
                totalPriceNGN: serviceResponse.totalPrice || 0,
                currency: serviceResponse.currency,
                provider: 'DHL',
                productCode: serviceResponse.productCode,
                productName: serviceResponse.product,
                estimatedDeliveryDate: serviceResponse.estimatedDeliveryDate,
                cached: false
            };

            cacheShippingRate(cacheKey, shippingResult);
            return shippingResult;

        } catch (dhlError) {
            // RESILIENCE: Try to use cached rate for same destination
            console.warn(`[RESILIENCE] DHL API failed: ${dhlError.message}`);

            const fallbackRate = getLastSuccessfulRate(
                normalizedReceiverDetails.countryCode,
                normalizedReceiverDetails.postalCode
            );

            if (fallbackRate) {
                console.log('[RESILIENCE] Using fallback cached rate');
                return {
                    ...fallbackRate,
                    cached: true,
                    fallback: true
                };
            }

            // No cache available - fail the request
            throw new Error(`Unable to calculate shipping fee: ${dhlError.message}. Please try again.`);
        }

    } catch (error) {
        console.error('Shipping Calculation Error:', error.message);
        throw error;
    }
};

/**
 * Export cache management functions for testing
 */
module.exports.clearShippingCache = () => {
    shippingCache.clear();
};

module.exports.getShippingCacheSize = () => {
    return shippingCache.size;
};

module.exports.shippingCache = shippingCache;
