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

        // OPTIMIZATION: 3D Volumetric Package Consolidation
        const packages = [];
        const MAX_PACKAGE_WEIGHT = 70; // kg
        const MAX_PACKAGE_VOLUME = 250000; // cm³ (e.g., 50x50x100cm)

        let currentPackageWeight = 0;
        let currentPackageVolume = 0;
        let currentMaxL = 0, currentMaxW = 0, currentMaxH = 0;

        // Flatten all items from all sellers into a single list for global consolidation
        const allItems = sellers.flatMap(s => s.items);

        for (const item of allItems) {
            const product = productMap.get(item.productId.toString());
            if (!product) {
                throw new Error(`Product not found: ${item.productId}`);
            }

            // CONVERSION: Assume DB stores Grams and MM
            // Weight: Grams -> KG
            const rawWeight = parseFloat(product.weight) || DEFAULT_PACKAGE_SPECS.WEIGHT;
            const weightUnit = product.weightUnit || 'kg';
            const unitWeight = weightUnit === 'g' ? rawWeight / 1000 : rawWeight;

            // Dimensions: MM -> CM
            const rawL = product.dimensions?.length || DEFAULT_PACKAGE_SPECS.LENGTH;
            const rawW = product.dimensions?.width || DEFAULT_PACKAGE_SPECS.WIDTH;
            const rawH = product.dimensions?.height || DEFAULT_PACKAGE_SPECS.HEIGHT;

            const dimUnit = product.dimensions?.unit || 'cm';

            const length = dimUnit === 'mm' ? rawL / 10 : rawL;
            const width = dimUnit === 'mm' ? rawW / 10 : rawW;
            const height = dimUnit === 'mm' ? rawH / 10 : rawH;

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

                // If package is full OR we are at the end of items
                // Note: The "item === allItems[allItems.length - 1]" check is handled after the loop for the last package
                if (canFit === 0) {
                    if (currentPackageWeight > 0) {
                        packages.push({
                            weight: Number(currentPackageWeight.toFixed(2)),
                            dimensions: {
                                length: Math.ceil(currentMaxL),
                                width: Math.ceil(currentMaxW),
                                height: Math.ceil(currentMaxH)
                            }
                        });
                        currentPackageWeight = 0;
                        currentPackageVolume = 0;
                        currentMaxL = 0; currentMaxW = 0; currentMaxH = 0;
                    }

                    // If a single unit is bigger than a whole box
                    if (unitWeight > MAX_PACKAGE_WEIGHT || unitVolume > MAX_PACKAGE_VOLUME) {
                        packages.push({
                            weight: Number(unitWeight.toFixed(2)),
                            dimensions: {
                                length: Math.ceil(length),
                                width: Math.ceil(width),
                                height: Math.ceil(height)
                            }
                        });
                        remainingQuantity--;
                    }
                }
            }
        }

        // Push final package if it has contents
        if (currentPackageWeight > 0) {
            packages.push({
                weight: Number(currentPackageWeight.toFixed(2)),
                dimensions: {
                    length: Math.ceil(currentMaxL),
                    width: Math.ceil(currentMaxW),
                    height: Math.ceil(currentMaxH)
                }
            });
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
