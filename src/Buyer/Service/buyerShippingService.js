const fxService = require('./adminControlledFxService');
const { Product } = require('../../models/productModel');
const shippingProviderService = require('./shippingProviderService');

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

const shippingCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

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

function generateShippingCacheKey(provider, shipper, receiver, packages) {
    const packageHash = packages.map((pkg) =>
        `${pkg.weight}-${pkg.dimensions.length}x${pkg.dimensions.width}x${pkg.dimensions.height}`
    ).sort().join('|');

    return `shipping:${provider}:${shipper.countryCode}:${shipper.postalCode}:${receiver.countryCode}:${receiver.postalCode}:${packageHash}`;
}

function getCachedShippingRate(key) {
    const cached = shippingCache.get(key);
    if (!cached) {
        return null;
    }

    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
        shippingCache.delete(key);
        return null;
    }

    return cached.data;
}

function cacheShippingRate(key, data) {
    shippingCache.set(key, {
        data,
        timestamp: Date.now()
    });

    if (shippingCache.size > 1000) {
        const now = Date.now();
        for (const [cacheKey, value] of shippingCache.entries()) {
            if (now - value.timestamp > CACHE_TTL_MS) {
                shippingCache.delete(cacheKey);
            }
        }
    }
}

function getLastSuccessfulRate(provider, receiverCountryCode, receiverPostalCode) {
    for (const [key, value] of shippingCache.entries()) {
        if (key.includes(`:${provider}:`) && key.includes(receiverCountryCode) && key.includes(receiverPostalCode)) {
            if (Date.now() - value.timestamp <= CACHE_TTL_MS) {
                console.log(`[FALLBACK] Using cached ${provider} rate for ${receiverCountryCode}:${receiverPostalCode}`);
                return value.data;
            }
        }
    }

    return null;
}

module.exports.calculateConsolidatedShipping = async (deliveryAddress, sellers, products = null) => {
    try {
        const plannedShippingDateAndTime = calculateShippingDate();
        const selectedProvider = shippingProviderService.getDefaultShippingProvider();

        let productMap;
        if (products && Array.isArray(products)) {
            productMap = new Map(products.map((product) => [product._id.toString(), product]));
        } else {
            const productIds = sellers.flatMap((seller) => seller.items.map((item) => item.productId));
            const fetchedProducts = await Product.find({ _id: { $in: productIds } }).lean();
            productMap = new Map(fetchedProducts.map((product) => [product._id.toString(), product]));
        }

        const normalizedReceiverDetails = {
            postalCode: deliveryAddress.postalCode,
            cityName: normalizeCityForDHL(deliveryAddress.cityName, deliveryAddress.countryCode),
            countryCode: deliveryAddress.countryCode,
            addressLine1: deliveryAddress.address || deliveryAddress.addressLine1 || '',
            countryName: deliveryAddress.countryName || deliveryAddress.countryCode
        };

        if (deliveryAddress.countryName) {
            normalizedReceiverDetails.countyName = deliveryAddress.countryName;
        }

        const packages = [];
        const MAX_PACKAGE_WEIGHT = 70;
        const MAX_PACKAGE_VOLUME = 250000;

        let currentPackageWeight = 0;
        let currentPackageVolume = 0;
        let currentMaxL = 0;
        let currentMaxW = 0;
        let currentMaxH = 0;

        const allItems = sellers.flatMap((seller) => seller.items);

        for (const item of allItems) {
            const product = productMap.get(item.productId.toString());
            if (!product) {
                throw new Error(`Product not found: ${item.productId}`);
            }

            const rawWeight = parseFloat(product.weight) || DEFAULT_PACKAGE_SPECS.WEIGHT;
            const weightUnit = product.weightUnit || 'kg';
            const unitWeight = weightUnit === 'g' ? rawWeight / 1000 : rawWeight;

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
                    currentPackageWeight += unitsToPack * unitWeight;
                    currentPackageVolume += unitsToPack * unitVolume;
                    currentMaxL = Math.max(currentMaxL, length);
                    currentMaxW = Math.max(currentMaxW, width);
                    currentMaxH = Math.max(currentMaxH, height);
                    remainingQuantity -= unitsToPack;
                }

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
                        currentMaxL = 0;
                        currentMaxW = 0;
                        currentMaxH = 0;
                    }

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

        if (!packages.length) {
            throw new Error('No packages to ship');
        }

        const normalizedShipperDetails = {
            ...SHIPPER_DETAILS,
            cityName: normalizeCityForDHL(SHIPPER_DETAILS.cityName, SHIPPER_DETAILS.countryCode)
        };

        const cacheKey = generateShippingCacheKey(
            selectedProvider,
            normalizedShipperDetails,
            normalizedReceiverDetails,
            packages
        );
        const cachedRate = getCachedShippingRate(cacheKey);

        if (cachedRate) {
            console.log(`Cache hit for ${selectedProvider} shipping calculation`);
            return {
                ...cachedRate,
                cached: true
            };
        }

        let serviceResponse;
        try {
            const providerResponse = await shippingProviderService.getDeliveryRate({
                provider: selectedProvider,
                plannedShippingDateAndTime,
                shipperDetails: normalizedShipperDetails,
                receiverDetails: normalizedReceiverDetails,
                packages,
            });
            serviceResponse = providerResponse.response;

            if (serviceResponse.currency === 'NGN' && serviceResponse.totalPrice) {
                try {
                    const usdPrice = await fxService.convertNGNtoUSD(serviceResponse.totalPrice);
                    serviceResponse.totalPriceUSD = Number((usdPrice + 1.5).toFixed(2));
                } catch (error) {
                    console.error('Failed to convert shipping fee to USD:', error.message);
                    serviceResponse.totalPriceUSD = Number((serviceResponse.totalPrice / 1500).toFixed(2));
                }
            } else if (serviceResponse.currency === 'USD' && serviceResponse.totalPrice) {
                serviceResponse.totalPriceUSD = Number((serviceResponse.totalPrice + 1.5).toFixed(2));
            }

            const shippingResult = {
                totalPriceUSD: serviceResponse.totalPriceUSD || 0,
                totalPriceNGN: serviceResponse.totalPrice || 0,
                currency: serviceResponse.currency,
                provider: selectedProvider,
                product: serviceResponse.product,
                productCode: serviceResponse.productCode,
                productName: serviceResponse.product,
                estimatedDeliveryDate: serviceResponse.estimatedDeliveryDate,
                totalTransitDays: serviceResponse.totalTransitDays || null,
                cached: false
            };

            cacheShippingRate(cacheKey, shippingResult);
            return shippingResult;

        } catch (providerError) {
            console.warn(`[RESILIENCE] ${selectedProvider} API failed: ${providerError.message}`);

            const fallbackRate = getLastSuccessfulRate(
                selectedProvider,
                normalizedReceiverDetails.countryCode,
                normalizedReceiverDetails.postalCode
            );

            if (fallbackRate) {
                console.log(`[RESILIENCE] Using fallback cached ${selectedProvider} rate`);
                return {
                    ...fallbackRate,
                    cached: true,
                    fallback: true
                };
            }

            throw new Error(`Unable to calculate shipping fee: ${providerError.message}. Please try again.`);
        }

    } catch (error) {
        console.error('Shipping Calculation Error:', error.message);
        throw error;
    }
};

module.exports.clearShippingCache = () => {
    shippingCache.clear();
};

module.exports.getShippingCacheSize = () => {
    return shippingCache.size;
};

module.exports.shippingCache = shippingCache;
