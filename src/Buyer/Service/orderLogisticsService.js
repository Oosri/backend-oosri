const Order = require('../models/buyerOrderModel');
const Buyer = require('../models/buyerAuthModel');
const { Product } = require('../../models/productModel');
const shippingProviderService = require('./shippingProviderService');
const { addEmailJob } = require('../../queues/email.queue');

const SHIPPER_CONFIG = {
  addressLine1: process.env.DHL_PICKUP_ADDRESS_LINE1,
  addressLine2: process.env.DHL_PICKUP_ADDRESS_LINE2,
  cityName: process.env.DHL_PICKUP_CITY,
  postalCode: process.env.DHL_PICKUP_POSTAL_CODE,
  countyName: process.env.DHL_PICKUP_COUNTY,
  countryCode: process.env.DHL_PICKUP_COUNTRY_CODE || 'NG',
  fullName: process.env.DHL_PICKUP_CONTACT_NAME || process.env.EMAIL_TEAM,
  companyName: process.env.DHL_PICKUP_COMPANY_NAME || process.env.EMAIL_TEAM || 'Oosri',
  email: process.env.DHL_PICKUP_CONTACT_EMAIL || process.env.EMAIL_SENDER,
  phone: process.env.DHL_PICKUP_CONTACT_PHONE
};

const DEFAULT_PACKAGE_SPECS = {
  weight: 0.5,
  length: 10,
  width: 10,
  height: 5
};

function calculatePickupDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const isoString = date.toISOString().split('.')[0];
  return `${isoString}GMT+01:00`;
}

function normalizeCityForDHL(cityName, countryCode) {
  if (!cityName || countryCode !== 'NG') {
    return cityName || 'Unknown';
  }

  const normalizedCity = cityName.toLowerCase().trim();
  const lagosSuburbs = [
    'iju-ishaga', 'iju', 'ishaga', 'agege', 'alimosho',
    'amuwo-odofin', 'apapa', 'badagry', 'epe', 'eti-osa',
    'ibeju-lekki', 'ifako-ijaiye', 'kosofe', 'mushin',
    'oshodi-isolo', 'shomolu', 'surulere', 'victoria island',
    'lekki', 'ajah', 'ikoyi', 'yaba', 'ikeja'
  ];

  if (lagosSuburbs.some((suburb) => normalizedCity.includes(suburb))) {
    return 'Lagos';
  }

  return cityName;
}

function splitAddressIntelligently(addressStr, maxLength = 45) {
  if (!addressStr) {
    return [''];
  }

  const cleanAddress = addressStr.replace(/\s+/g, ' ').trim();
  if (cleanAddress.length <= maxLength) {
    return [cleanAddress];
  }

  const words = cleanAddress.split(' ');
  const lines = [];
  let currentLine = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const word = words[index];
    if ((currentLine + ' ' + word).length <= maxLength) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  lines.push(currentLine);

  return lines.flatMap((line) => {
    if (line.length > maxLength) {
      return line.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [line];
    }

    return [line];
  });
}

function buildFullAddress(parts) {
  return [
    parts.addressLine1 || parts.address || '',
    parts.addressLine2 || '',
    parts.cityName || '',
    parts.countyName || parts.countryName || '',
    parts.postalCode || '',
    parts.countryName || parts.countryCode || ''
  ].filter(Boolean).join(', ');
}

function buildPackages(orderItems, productMap) {
  const packages = [];

  for (const item of orderItems) {
    const product = productMap.get(item.productId.toString());
    const rawWeight = parseFloat(product?.weight) || DEFAULT_PACKAGE_SPECS.weight;
    const weightUnit = product?.weightUnit || 'kg';
    const weight = weightUnit === 'g' ? rawWeight / 1000 : rawWeight;

    const rawLength = product?.dimensions?.length || DEFAULT_PACKAGE_SPECS.length;
    const rawWidth = product?.dimensions?.width || DEFAULT_PACKAGE_SPECS.width;
    const rawHeight = product?.dimensions?.height || DEFAULT_PACKAGE_SPECS.height;
    const dimensionUnit = product?.dimensions?.unit || 'cm';

    const length = dimensionUnit === 'mm' ? rawLength / 10 : rawLength;
    const width = dimensionUnit === 'mm' ? rawWidth / 10 : rawWidth;
    const height = dimensionUnit === 'mm' ? rawHeight / 10 : rawHeight;

    for (let index = 0; index < item.quantity; index += 1) {
      packages.push({
        weight: Number(weight.toFixed(2)),
        dimensions: {
          length: Math.ceil(length),
          width: Math.ceil(width),
          height: Math.ceil(height)
        }
      });
    }
  }

  return packages;
}

function buildManualProcessingEmailPayload({ orders, buyer, paymentIntentId, errorMessage, providerLabel }) {
  const firstAddress = orders[0]?.deliveryAddresses?.[0] || {};
  const items = orders.flatMap((order) =>
    (order.products || []).map((item) => ({
      orderId: order._id.toString(),
      productName: item.productName,
      quantity: item.quantity
    }))
  );

  return {
    orderIds: orders.map((order) => order._id.toString()),
    buyerName: buyer?.fullName || 'Unknown Buyer',
    buyerEmail: buyer?.email || 'N/A',
    buyerPhone: buyer?.phoneNumber || orders[0]?.phoneNumber || 'N/A',
    deliveryAddress: firstAddress,
    items,
    paymentReference: paymentIntentId,
    timestamp: new Date().toISOString(),
    provider: providerLabel,
    explicitFlag: `${providerLabel} Shipment Failed - Manual Processing Required`,
    dhlError: errorMessage
  };
}

function buildShipmentSuccessEmailPayload({ orders, buyer, paymentIntentId, shipmentData, providerLabel }) {
  const firstAddress = orders[0]?.deliveryAddresses?.[0] || {};
  const items = orders.flatMap((order) =>
    (order.products || []).map((item) => ({
      orderId: order._id.toString(),
      productName: item.productName,
      quantity: item.quantity
    }))
  );

  return {
    orderIds: orders.map((order) => order._id.toString()),
    buyerName: buyer?.fullName || 'Unknown Buyer',
    buyerEmail: buyer?.email || 'N/A',
    buyerPhone: buyer?.phoneNumber || orders[0]?.phoneNumber || 'N/A',
    deliveryAddress: firstAddress,
    items,
    paymentReference: paymentIntentId,
    timestamp: new Date().toISOString(),
    provider: providerLabel,
    shipmentDetails: {
      pickupConfirmationNumber: shipmentData.shipmentReference || shipmentData.pickupConfirmationNumber,
      readyByTime: shipmentData.readyByTime || 'N/A',
      nextPickupCutoffTime: shipmentData.nextPickupCutoffTime || 'N/A',
      warning: shipmentData.warning || null,
      shipmentStatus: shipmentData.shipmentStatus || null,
      shipmentPaymentStatus: shipmentData.shipmentPaymentStatus || null,
    }
  };
}

async function queueManualProcessingEmail(payload) {
  const primaryLogisticsEmail = process.env.LOGISTICS_PROCESSING_EMAIL || 'logisticsprocessing@oosri.com';
  const secondaryAdminEmail = process.env.SUPPORT_EMAIL || 'super.admin@oosri.com';
  const recipients = [primaryLogisticsEmail, secondaryAdminEmail];

  for (const recipient of recipients) {
    try {
      await addEmailJob('logistics-processing-required', {
        to: recipient,
        ...payload
      }, { priority: 4 });
      console.log(`Enqueued logistics manual processing email for: ${recipient}`);
    } catch (err) {
      console.error(`Failed to enqueue logistics email for ${recipient}:`, err.message);
    }
  }
}

async function queueShipmentSuccessEmail(payload) {
  const primaryLogisticsEmail = process.env.LOGISTICS_PROCESSING_EMAIL || 'logisticsprocessing@oosri.com';
  const secondaryAdminEmail = process.env.SUPPORT_EMAIL || 'super.admin@oosri.com';
  const recipients = [primaryLogisticsEmail, secondaryAdminEmail];

  for (const recipient of recipients) {
    try {
      await addEmailJob('logistics-shipment-success', {
        to: recipient,
        ...payload
      }, { priority: 5 });
      console.log(`Enqueued logistics shipment success email for: ${recipient}`);
    } catch (err) {
      console.error(`Failed to enqueue logistics success email for ${recipient}:`, err.message);
    }
  }
}

function buildDhlShipmentPayload({ deliveryAddress, buyer, orderItems, productMap, declaredValue }) {
  const receiverAddress = splitAddressIntelligently(deliveryAddress.address || 'Address unavailable');
  const shipperAddress = splitAddressIntelligently(SHIPPER_CONFIG.addressLine1 || '');

  return {
    provider: 'DHL',
    plannedPickupDateAndTime: calculatePickupDate(),
    closeTime: process.env.DHL_PICKUP_CLOSE_TIME || '17:00',
    location: process.env.DHL_PICKUP_LOCATION || 'Reception Area',
    locationType: process.env.DHL_PICKUP_LOCATION_TYPE || 'business',
    customerDetails: {
      shipperDetails: {
        postalAddress: {
          addressLine1: shipperAddress[0] || SHIPPER_CONFIG.addressLine1,
          ...(shipperAddress[1] && { addressLine2: shipperAddress[1] }),
          ...(shipperAddress[2] && { addressLine3: shipperAddress[2] }),
          postalCode: SHIPPER_CONFIG.postalCode,
          cityName: normalizeCityForDHL(SHIPPER_CONFIG.cityName, SHIPPER_CONFIG.countryCode),
          countyName: SHIPPER_CONFIG.countyName,
          countryCode: SHIPPER_CONFIG.countryCode
        },
        contactInformation: {
          fullName: SHIPPER_CONFIG.fullName,
          companyName: SHIPPER_CONFIG.companyName,
          email: SHIPPER_CONFIG.email,
          phone: SHIPPER_CONFIG.phone
        }
      },
      receiverDetails: {
        postalAddress: {
          addressLine1: receiverAddress[0] || 'Address unavailable',
          ...(receiverAddress[1] && { addressLine2: receiverAddress[1] }),
          ...(receiverAddress[2] && { addressLine3: receiverAddress[2] }),
          postalCode: deliveryAddress.postalCode || '000000',
          cityName: normalizeCityForDHL(deliveryAddress.cityName, deliveryAddress.countryCode),
          countyName: deliveryAddress.countryName,
          countryCode: deliveryAddress.countryCode || 'NG'
        },
        contactInformation: {
          fullName: buyer?.fullName || 'Valued Customer',
          companyName: buyer?.fullName || 'Valued Customer',
          email: buyer?.email || process.env.EMAIL_SENDER,
          phone: buyer?.phoneNumber || SHIPPER_CONFIG.phone
        }
      }
    },
    shipmentDetails: [{
      productCode: process.env.DHL_PICKUP_PRODUCT_CODE || 'P',
      isCustomsDeclarable: true,
      declaredValue: declaredValue > 0 ? declaredValue : 1,
      declaredValueCurrency: process.env.DHL_PICKUP_DECLARED_VALUE_CURRENCY || 'NGN',
      unitOfMeasurement: 'metric',
      packages: buildPackages(orderItems, productMap)
    }]
  };
}

function buildHaulamShipmentPayload({ deliveryAddress, buyer, orderItems, productMap, declaredValue }) {
  const packages = buildPackages(orderItems, productMap);
  const packageValue = packages.length > 0
    ? Number((declaredValue / packages.length).toFixed(2))
    : 0;

  return {
    provider: 'HAULAM',
    originAddress: buildFullAddress({
      addressLine1: SHIPPER_CONFIG.addressLine1,
      addressLine2: SHIPPER_CONFIG.addressLine2,
      cityName: SHIPPER_CONFIG.cityName,
      countyName: SHIPPER_CONFIG.countyName,
      postalCode: SHIPPER_CONFIG.postalCode,
      countryCode: SHIPPER_CONFIG.countryCode,
    }),
    destinationAddress: buildFullAddress({
      address: deliveryAddress.address || 'Address unavailable',
      cityName: deliveryAddress.cityName,
      countryName: deliveryAddress.countryName,
      postalCode: deliveryAddress.postalCode,
      countryCode: deliveryAddress.countryCode || 'NG',
    }),
    serviceType: process.env.HAULAM_SERVICE_TYPE || 'valueImport',
    shipper: {
      name: SHIPPER_CONFIG.fullName,
      email: SHIPPER_CONFIG.email,
      phone: SHIPPER_CONFIG.phone,
    },
    receiver: {
      name: buyer?.fullName || 'Valued Customer',
      email: buyer?.email || process.env.EMAIL_SENDER,
      phone: buyer?.phoneNumber || SHIPPER_CONFIG.phone,
    },
    packages: packages.map((pkg) => ({
      weight: pkg.weight,
      length: pkg.dimensions.length,
      width: pkg.dimensions.width,
      height: pkg.dimensions.height,
      description: 'Oosri order package',
      value: packageValue,
    }))
  };
}

function buildShipmentRequest({ provider, deliveryAddress, buyer, orderItems, productMap, declaredValue }) {
  if (provider === 'HAULAM') {
    return buildHaulamShipmentPayload({
      deliveryAddress,
      buyer,
      orderItems,
      productMap,
      declaredValue,
    });
  }

  return buildDhlShipmentPayload({
    deliveryAddress,
    buyer,
    orderItems,
    productMap,
    declaredValue,
  });
}

async function safeCreateShipment(provider, requestPayload) {
  try {
    const shipmentResponse = await shippingProviderService.createShipment({
      provider,
      ...requestPayload
    });

    const response = shipmentResponse.response || {};
    const shipmentReference = response.shipmentReference || response.pickupConfirmationNumber || response.shipmentId;

    if (!shipmentReference) {
      throw new Error(`Malformed ${provider} shipment response: shipment reference missing`);
    }

    return {
      success: true,
      data: {
        provider,
        shipmentId: response.shipmentId || null,
        shipmentReference,
        shipmentStatus: response.shipmentStatus || (provider === 'HAULAM' ? 'Created' : 'Pickup Scheduled'),
        shipmentPaymentStatus: response.shipmentPaymentStatus || null,
        readyByTime: response.readyByTime || null,
        nextPickupCutoffTime: response.nextPickupCutoffTime || null,
        warning: response.warning || null,
        details: response.details || response,
      }
    };
  } catch (error) {
    return { success: false, error };
  }
}

module.exports.processOrdersLogistics = async ({ orderIds, buyerId, paymentIntentId }) => {
  const orders = await Order.find({ _id: { $in: orderIds } }).lean();
  if (!orders.length) {
    return { success: false, skipped: true, reason: 'orders_not_found' };
  }

  const provider = shippingProviderService.normalizeShippingProvider(
    orders[0]?.shippingProvider || process.env.DEFAULT_PROVIDER
  ) || shippingProviderService.SUPPORTED_PROVIDERS.DHL;

  const buyer = await Buyer.findById(buyerId).select('fullName email phoneNumber').lean();
  const orderItems = orders.flatMap((order) => order.products || []);
  const productIds = orderItems.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } })
    .select('weight weightUnit dimensions')
    .lean();
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));

  const deliveryAddress = orders[0]?.deliveryAddresses?.[0] || {};
  const declaredValue = orders.reduce(
    (sum, order) => sum + (order.products || []).reduce((orderSum, item) => orderSum + (item.totalPrice || 0), 0),
    0
  );

  const requestPayload = buildShipmentRequest({
    provider,
    deliveryAddress,
    buyer,
    orderItems,
    productMap,
    declaredValue,
  });

  const result = await safeCreateShipment(provider, requestPayload);
  if (result.success) {
    await Order.updateMany(
      { _id: { $in: orderIds } },
      {
        $set: {
          shippingProvider: provider,
          shipmentId: result.data.shipmentId,
          shipmentReference: result.data.shipmentReference,
          shipmentStatus: result.data.shipmentStatus,
          shipmentPaymentStatus: result.data.shipmentPaymentStatus,
          shipmentLastUpdatedAt: new Date(),
        }
      }
    );

    const successPayload = buildShipmentSuccessEmailPayload({
      orders,
      buyer,
      paymentIntentId,
      shipmentData: result.data,
      providerLabel: provider,
    });

    setImmediate(async () => {
      try {
        await queueShipmentSuccessEmail(successPayload);
      } catch (emailError) {
        console.error('Failed to enqueue logistics shipment success email', {
          orderIds,
          paymentIntentId,
          error: emailError.message
        });
      }
    });

    return result;
  }

  const errorMessage = result.error?.message || `Unknown ${provider} shipment failure`;
  await Order.updateMany(
    { _id: { $in: orderIds } },
    {
      $set: {
        orderStatus: 'pending_logistics',
        shippingProvider: provider,
      }
    }
  );

  console.error(`${provider} shipment creation failed`, {
    orderIds,
    paymentIntentId,
    error: errorMessage,
    requestPayload
  });

  const emailPayload = buildManualProcessingEmailPayload({
    orders,
    buyer,
    paymentIntentId,
    errorMessage,
    providerLabel: provider,
  });

  try {
    await queueManualProcessingEmail(emailPayload);
  } catch (emailError) {
    console.error('Failed to enqueue logistics manual processing email', {
      orderIds,
      paymentIntentId,
      error: emailError.message
    });
  }

  return result;
};
