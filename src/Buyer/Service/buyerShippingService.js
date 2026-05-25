const fxService = require('./adminControlledFxService');
const { Product } = require('../../models/productModel');
const shippingProviderService = require('./shippingProviderService');

const SHIPPER_DETAILS = {
    addressLine1: '3 Close B, Unity Estate Off Alkat way',
    cityName: 'Iju-Ishaga',
    postalCode: '100216',
    countyName: 'Lagos',
    countryCode: 'NG',
    countryName: 'Nigeria'
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

function generateShippingCacheKey(provider, shipper, receiver, packages, selectedServiceType = '') {
    const packageHash = packages.map((pkg) =>
        `${pkg.weight}-${pkg.dimensions.length}x${pkg.dimensions.width}x${pkg.dimensions.height}-${pkg.value || 0}`
    ).sort().join('|');

    const serviceTypeKey = selectedServiceType ? selectedServiceType.toString().trim().toLowerCase() : 'default';
    return `shipping:${provider}:${shipper.countryCode}:${shipper.postalCode}:${receiver.countryCode}:${receiver.postalCode}:${packageHash}:${serviceTypeKey}`;
}

function normalizeShippingEstimates(serviceResponse) {
    if (Array.isArray(serviceResponse?.estimates) && serviceResponse.estimates.length > 0) {
        return serviceResponse.estimates.map((estimate) => ({
            serviceType: estimate.serviceType || estimate.productCode || '',
            serviceName: estimate.serviceName || estimate.product || estimate.serviceType || 'Shipping Option',
            estimate: Number(estimate.estimate || 0),
            estimateUSD: Number(estimate.estimateUSD || 0),
            currency: estimate.currency || serviceResponse.currency || 'USD',
            description: estimate.description || null,
            features: Array.isArray(estimate.features) ? estimate.features : [],
            estimatedDeliveryDate: estimate.estimatedDeliveryDate || null,
            totalTransitDays: estimate.totalTransitDays || null,
            ...estimate,
        }));
    }

    return [
        {
            serviceType: serviceResponse?.productCode || '',
            serviceName: serviceResponse?.product || 'Shipping',
            estimate: Number(serviceResponse?.totalPrice || 0),
            estimateUSD: Number(serviceResponse?.totalPriceUSD || 0),
            currency: serviceResponse?.currency || 'USD',
            description: serviceResponse?.description || null,
            features: Array.isArray(serviceResponse?.features) ? serviceResponse.features : [],
            estimatedDeliveryDate: serviceResponse?.estimatedDeliveryDate || null,
            totalTransitDays: serviceResponse?.totalTransitDays || null,
        }
    ];
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

const NIGERIAN_FLAT_RATE_NGN = 2000;

module.exports.calculateConsolidatedShipping = async (deliveryAddress, sellers, products = null, options = {}) => {
    try {
        // Local Nigerian deliveries use a flat rate — skip DHL/Haulam entirely
        if (deliveryAddress.countryCode === 'NG') {
            const fxRate = await fxService.getFxRateNGNtoUSD();
            const flatRateUSD = Number((NIGERIAN_FLAT_RATE_NGN * fxRate).toFixed(2));
            return {
                totalPriceNGN: NIGERIAN_FLAT_RATE_NGN,
                totalPriceUSD: flatRateUSD,
                currency: 'NGN',
                provider: 'FLAT_RATE',
                providerDisplayName: 'Standard Delivery',
                product: 'Standard Delivery',
                productCode: 'NG_FLAT_RATE',
                productName: 'Standard Delivery',
                selectedServiceType: 'NG_FLAT_RATE',
                selectedServiceName: 'Standard Delivery',
                estimatedDeliveryDate: null,
                totalTransitDays: 3,
                description: 'Standard flat-rate delivery within Nigeria (3–5 business days)',
                features: ['Door-to-door delivery', 'SMS tracking updates'],
                estimates: [{
                    serviceType: 'NG_FLAT_RATE',
                    serviceName: 'Standard Delivery',
                    estimate: NIGERIAN_FLAT_RATE_NGN,
                    estimateUSD: flatRateUSD,
                    currency: 'NGN',
                    description: 'Standard flat-rate delivery within Nigeria (3–5 business days)',
                    features: ['Door-to-door delivery', 'SMS tracking updates'],
                    estimatedDeliveryDate: null,
                    totalTransitDays: 3
                }],
                cached: false
            };
        }

        const plannedShippingDateAndTime = calculateShippingDate();
        const selectedProvider = shippingProviderService.getDefaultShippingProviderForAddress(deliveryAddress);
        const selectedServiceType = typeof options?.selectedServiceType === 'string'
            ? options.selectedServiceType.trim()
            : '';

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
        let currentPackageValue = 0;
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
            const unitValue = Number(product.salesPrice > 0 ? product.salesPrice : product.regularPrice) || 0;

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
                    currentPackageValue += unitsToPack * unitValue;
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
                            },
                            value: Number(currentPackageValue.toFixed(2))
                        });
                        currentPackageWeight = 0;
                        currentPackageVolume = 0;
                        currentPackageValue = 0;
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
                            },
                            value: Number(unitValue.toFixed(2))
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
                },
                value: Number(currentPackageValue.toFixed(2))
            });
        }

        if (!packages.length) {
            throw new Error('No packages to ship');
        }

        const normalizedShipperDetails = {
            ...SHIPPER_DETAILS,
            cityName: normalizeCityForDHL(SHIPPER_DETAILS.cityName, SHIPPER_DETAILS.countryCode)
        };

        let serviceResponse;
        let actualProviderUsed = selectedProvider;
        let effectiveServiceType = selectedServiceType;

        // Force ExpressExport for Haulam when no explicit service type is selected
        if (selectedProvider === 'HAULAM' && !effectiveServiceType) {
            effectiveServiceType = 'expressExport';
        }

        const cacheKey = generateShippingCacheKey(
            selectedProvider,
            normalizedShipperDetails,
            normalizedReceiverDetails,
            packages,
            selectedProvider === 'HAULAM' ? effectiveServiceType : ''
        );
        const cachedRate = getCachedShippingRate(cacheKey);

        if (cachedRate) {
            console.log(`Cache hit for ${selectedProvider} shipping calculation`);
            return {
                ...cachedRate,
                cached: true
            };
        }

        try {
            const providerResponse = await shippingProviderService.getDeliveryRate({
                provider: selectedProvider,
                plannedShippingDateAndTime,
                shipperDetails: normalizedShipperDetails,
                receiverDetails: normalizedReceiverDetails,
                packages,
                preferredServiceType: selectedProvider === 'HAULAM'
                    ? effectiveServiceType
                    : selectedServiceType || undefined,
            });
            serviceResponse = providerResponse.response;
            actualProviderUsed = selectedProvider;
        } catch (providerError) {
            console.warn(`[RESILIENCE] Primary provider ${selectedProvider} API failed: ${providerError.message}`);

            // Attempt fallback to the other provider (e.g., if Haulam fails for domestic)
            const alternativeProvider = selectedProvider === 'HAULAM' ? 'DHL' : 'HAULAM';
            console.log(`[RESILIENCE] Attempting fallback to ${alternativeProvider}...`);
            let fallbackErrorMessage = null;

            try {
                const fallbackProviderResponse = await shippingProviderService.getDeliveryRate({
                    provider: alternativeProvider,
                    plannedShippingDateAndTime,
                    shipperDetails: normalizedShipperDetails,
                    receiverDetails: normalizedReceiverDetails,
                    packages,
                    preferredServiceType: alternativeProvider === 'HAULAM'
                        ? (selectedServiceType || 'expressExport')
                        : selectedServiceType || undefined,
                });
                serviceResponse = fallbackProviderResponse.response;
                actualProviderUsed = alternativeProvider;
                effectiveServiceType = alternativeProvider === 'HAULAM'
                    ? (selectedServiceType || 'expressExport')
                    : selectedServiceType;
                console.log(`[RESILIENCE] Successfully fell back to ${alternativeProvider}`);
            } catch (fallbackError) {
                fallbackErrorMessage = fallbackError.message;
                console.warn(`[RESILIENCE] Fallback provider ${alternativeProvider} also failed: ${fallbackError.message}`);
            }

            if (serviceResponse) {
                // Continue to normal response post-processing with the successful fallback.
            } else {
                const fallbackRate = getLastSuccessfulRate(
                    selectedProvider,
                    normalizedReceiverDetails.countryCode,
                    normalizedReceiverDetails.postalCode
                ) || getLastSuccessfulRate(
                    alternativeProvider,
                    normalizedReceiverDetails.countryCode,
                    normalizedReceiverDetails.postalCode
                );

                if (fallbackRate) {
                    console.log(`[RESILIENCE] Using cached shipping rate after provider failures`);
                    return {
                        ...fallbackRate,
                        cached: true,
                        fallback: true
                    };
                }

                throw new Error(
                    `Unable to calculate shipping fee with any provider. ` +
                    `Primary ${selectedProvider}: ${providerError.message}. ` +
                    `Fallback ${alternativeProvider}: ${fallbackErrorMessage || 'not attempted'}. ` +
                    `Please try again.`
                );
            }
        }

        // Post-process the successful response (from either primary or fallback)
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

        if (Array.isArray(serviceResponse.estimates) && serviceResponse.estimates.length > 0) {
            for (const estimate of serviceResponse.estimates) {
                const estimateAmount = Number(estimate?.estimate || 0);
                const estimateCurrency = estimate?.currency || serviceResponse.currency || 'USD';

                if (estimateAmount <= 0) {
                    estimate.estimateUSD = 0;
                    continue;
                }

                if (estimateCurrency === 'NGN') {
                    try {
                        const usdEstimate = await fxService.convertNGNtoUSD(estimateAmount);
                        estimate.estimateUSD = Number((usdEstimate + 1.5).toFixed(2));
                    } catch (error) {
                        estimate.estimateUSD = Number((estimateAmount / 1500 + 1.5).toFixed(2));
                    }
                    continue;
                }

                estimate.estimateUSD = Number((estimateAmount + 1.5).toFixed(2));
            }
        }

        const normalizedEstimates = normalizeShippingEstimates(serviceResponse);
        const selectedEstimate = (effectiveServiceType
            ? normalizedEstimates.find((estimate) =>
                estimate.serviceType?.toString().toLowerCase() === effectiveServiceType.toLowerCase()
            )
            : null) || normalizedEstimates[0];

        const PROVIDER_DISPLAY_NAMES = {
            HAULAM: 'Haulam Logistics',
            DHL: 'DHL Express',
        };

        const shippingResult = {
            totalPriceUSD: selectedEstimate?.estimateUSD || serviceResponse.totalPriceUSD || 0,
            totalPriceNGN: serviceResponse.totalPrice || 0,
            currency: serviceResponse.currency,
            provider: actualProviderUsed,
            providerDisplayName: PROVIDER_DISPLAY_NAMES[actualProviderUsed] || actualProviderUsed,
            product: selectedEstimate?.serviceName || serviceResponse.product,
            productCode: selectedEstimate?.serviceType || serviceResponse.productCode,
            productName: selectedEstimate?.serviceName || serviceResponse.product,
            estimatedDeliveryDate: selectedEstimate?.estimatedDeliveryDate || serviceResponse.estimatedDeliveryDate,
            totalTransitDays: selectedEstimate?.totalTransitDays || serviceResponse.totalTransitDays || null,
            selectedServiceType: selectedEstimate?.serviceType || serviceResponse.productCode || '',
            selectedServiceName: selectedEstimate?.serviceName || serviceResponse.product || '',
            description: selectedEstimate?.description || serviceResponse.description || null,
            features: selectedEstimate?.features || serviceResponse.features || [],
            estimates: normalizedEstimates,
            cached: false
        };

        cacheShippingRate(cacheKey, shippingResult);
        return shippingResult;

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
