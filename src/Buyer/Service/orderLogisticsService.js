const Order = require('../models/buyerOrderModel');
const Buyer = require('../models/buyerAuthModel');
const { Product } = require('../../models/productModel');
const buyerDHLService = require('./buyerDHLService');
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

function buildManualProcessingEmailPayload({ orders, buyer, paymentIntentId, errorMessage }) {
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
    explicitFlag: 'DHL Shipment Failed - Manual Processing Required',
    dhlError: errorMessage
  };
}

function buildShipmentSuccessEmailPayload({ orders, buyer, paymentIntentId, shipmentData }) {
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
    shipmentDetails: {
      pickupConfirmationNumber: shipmentData.pickupConfirmationNumber,
      readyByTime: shipmentData.readyByTime,
      nextPickupCutoffTime: shipmentData.nextPickupCutoffTime,
      warning: shipmentData.warning
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
      }, { priority: 5 }); // Slightly lower priority than manual processing required
      console.log(`Enqueued logistics shipment success email for: ${recipient}`);
    } catch (err) {
      console.error(`Failed to enqueue logistics success email for ${recipient}:`, err.message);
    }
  }
}


async function safeCreateDHLShipment(requestPayload) {
  try {
    const response = await buyerDHLService.schedulePickup(requestPayload);
    if (!response?.pickupConfirmationNumber) {
      throw new Error('Malformed DHL pickup response: pickupConfirmationNumber missing');
    }

    return { success: true, data: response };
  } catch (error) {
    return { success: false, error };
  }
}

module.exports.processOrdersLogistics = async ({ orderIds, buyerId, paymentIntentId }) => {
  const orders = await Order.find({ _id: { $in: orderIds } }).lean();
  if (!orders.length) {
    return { success: false, skipped: true, reason: 'orders_not_found' };
  }

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

  const pickupPayload = {
    plannedPickupDateAndTime: calculatePickupDate(),
    closeTime: process.env.DHL_PICKUP_CLOSE_TIME || '17:00',
    location: process.env.DHL_PICKUP_LOCATION || 'Reception Area',
    locationType: process.env.DHL_PICKUP_LOCATION_TYPE || 'business',
    customerDetails: {
      shipperDetails: {
        postalAddress: {
          addressLine1: SHIPPER_CONFIG.addressLine1,
          addressLine2: SHIPPER_CONFIG.addressLine2,
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
          addressLine1: deliveryAddress.address || 'Address unavailable',
          postalCode: deliveryAddress.postalCode || '000000',
          cityName: normalizeCityForDHL(deliveryAddress.cityName, deliveryAddress.countryCode),
          countyName: deliveryAddress.countryName,
          countryCode: deliveryAddress.countryCode || 'NG'
        },
        contactInformation: {
          fullName: buyer?.fullName || 'Valued Customer',
          companyName: buyer?.fullName || 'Valued Customer',
          email: buyer?.email || process.env.EMAIL_SENDER,
          phone: buyer?.phoneNumber || orders[0]?.phoneNumber || SHIPPER_CONFIG.phone
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

  const result = await safeCreateDHLShipment(pickupPayload);
  if (result.success) {
    // Senior Implementation: Notify admin and logistics of success
    const successPayload = buildShipmentSuccessEmailPayload({
      orders,
      buyer,
      paymentIntentId,
      shipmentData: result.data
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


  const errorMessage = result.error?.message || 'Unknown DHL shipment failure';
  await Order.updateMany(
    { _id: { $in: orderIds } },
    { $set: { orderStatus: 'pending_logistics' } }
  );

  console.error('DHL shipment creation failed', {
    orderIds,
    paymentIntentId,
    error: errorMessage,
    requestPayload: pickupPayload
  });

  const emailPayload = buildManualProcessingEmailPayload({
    orders,
    buyer,
    paymentIntentId,
    errorMessage
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
