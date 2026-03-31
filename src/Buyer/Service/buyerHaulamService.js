const axios = require('axios');
const constants = require('../constants');

const HAULAM_TEST_BASE_URL = 'https://api.haulam.com/api/v1/test';
const HAULAM_PRODUCTION_BASE_URL = 'https://api.haulam.com/api/v1';
const HAULAM_TIMEOUT_MS = 30000;

const getHaulamConfig = () => {
  const secretKey = process.env.HAULAM_SECRET_KEY;
  const isTestKey = secretKey && secretKey.startsWith('haulam_test_');

  return {
    secretKey,
    baseUrl: isTestKey ? HAULAM_TEST_BASE_URL : HAULAM_PRODUCTION_BASE_URL,
    serviceType: process.env.HAULAM_SERVICE_TYPE || 'valueImport',
  };
};

const getHeaders = (secretKey) => ({
  Authorization: `Bearer ${secretKey}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

const getPathValue = (object, path) => {
  return path.split('.').reduce((accumulator, key) => {
    if (accumulator === undefined || accumulator === null) {
      return undefined;
    }

    return accumulator[key];
  }, object);
};

const getFirstPresentValue = (object, paths) => {
  for (const path of paths) {
    const value = getPathValue(object, path);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return null;
};

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const buildAddressString = ({
  addressLine1,
  addressLine2,
  addressLine3,
  cityName,
  countyName,
  postalCode,
  countryCode,
  countryName,
}) => {
  return [
    addressLine1,
    addressLine2,
    addressLine3,
    cityName,
    countyName,
    postalCode,
    countryName || countryCode,
  ].filter(Boolean).join(', ');
};

const extractEstimateCandidates = (responseData) => {
  const root = responseData?.data ?? responseData;

  if (Array.isArray(root)) {
    return root;
  }

  const arrayPaths = [
    'estimates',
    'quotes',
    'rates',
    'data',
    'items',
    'results',
  ];

  for (const path of arrayPaths) {
    const value = getPathValue(root, path);
    if (Array.isArray(value) && value.length > 0) {
      return value;
    }
  }

  return root ? [root] : [];
};

const extractCandidateAmount = (candidate) => {
  const paths = [
    'amount',
    'price',
    'total',
    'totalPrice',
    'estimatedPrice',
    'estimatedAmount',
    'quote',
    'cost',
    'price.amount',
    'amount.value',
    'total.amount',
    'total.value',
    'price.value',
  ];

  const value = getFirstPresentValue(candidate, paths);
  return toNumber(value);
};

const extractCurrency = (candidate, responseData) => {
  const value = getFirstPresentValue(candidate, [
    'currency',
    'priceCurrency',
    'amountCurrency',
    'price.currency',
    'amount.currency',
    'total.currency',
  ]) || getFirstPresentValue(responseData, [
    'currency',
    'data.currency',
  ]);

  return value || 'NGN';
};

const normalizeEstimateResponse = (responseData, fallbackServiceType) => {
  const candidates = extractEstimateCandidates(responseData)
    .map((candidate) => ({
      candidate,
      amount: extractCandidateAmount(candidate),
    }))
    .filter(({ amount }) => amount !== null);

  if (!candidates.length) {
    throw new Error('Haulam estimate response did not include a usable amount.');
  }

  candidates.sort((left, right) => left.amount - right.amount);

  const selected = candidates[0].candidate;
  const totalPrice = candidates[0].amount;

  return {
    product: getFirstPresentValue(selected, ['serviceName', 'serviceType', 'name']) || 'Haulam Shipping',
    productCode: getFirstPresentValue(selected, ['serviceType', 'serviceCode', 'code']) || fallbackServiceType,
    currency: extractCurrency(selected, responseData),
    totalPrice,
    estimatedDeliveryDate: getFirstPresentValue(selected, [
      'estimatedDeliveryDate',
      'eta',
      'deliveryDate',
      'estimatedArrivalDate',
    ]),
    totalTransitDays: toNumber(getFirstPresentValue(selected, [
      'totalTransitDays',
      'transitDays',
      'etaDays',
      'deliveryWindow.days',
    ])),
    details: responseData,
  };
};

const normalizeShipmentResponse = (responseData, fallbackServiceType) => {
  const root = responseData?.data ?? responseData;
  const shipmentId = getFirstPresentValue(root, [
    'id',
    'shipmentId',
    'trackingNumber',
    'reference',
  ]);

  if (!shipmentId) {
    throw new Error('Haulam shipment response did not include a shipment identifier.');
  }

  return {
    shipmentId,
    shipmentReference: getFirstPresentValue(root, [
      'trackingNumber',
      'reference',
      'id',
      'shipmentId',
    ]) || shipmentId,
    shipmentStatus: getFirstPresentValue(root, ['status']) || 'Created',
    shipmentPaymentStatus: getFirstPresentValue(root, ['paymentStatus']) || null,
    serviceType: getFirstPresentValue(root, ['serviceType']) || fallbackServiceType,
    details: responseData,
  };
};

module.exports = {
  async validateAddress({ countryCode, cityName, postalCode }) {
    if (!countryCode || !cityName || !postalCode) {
      throw new Error(constants.shippingRateMessages.REQUIRED_FIELDS_MISSING);
    }

    return {
      valid: true,
      skipped: true,
      provider: 'HAULAM',
      message: 'Haulam does not expose a dedicated address validation endpoint; validation will occur during estimate/shipment requests.',
    };
  },

  async getDeliveryRate({
    shipperDetails,
    receiverDetails,
    packages,
  }) {
    try {
      const config = getHaulamConfig();

      if (!config.secretKey) {
        throw new Error('Haulam Rate Error: HAULAM_SECRET_KEY is missing');
      }

      const url = `${config.baseUrl}/estimate`;
      const payload = {
        originAddress: buildAddressString(shipperDetails),
        destinationAddress: buildAddressString(receiverDetails),
        packages: packages.map((pkg) => ({
          weight: pkg.weight,
          length: pkg.dimensions.length,
          width: pkg.dimensions.width,
          height: pkg.dimensions.height,
          description: pkg.description || 'Oosri order package',
          value: pkg.value || 0,
        })),
      };

      const response = await axios.post(url, payload, {
        headers: getHeaders(config.secretKey),
        timeout: HAULAM_TIMEOUT_MS,
      });

      return normalizeEstimateResponse(response.data, config.serviceType);
    } catch (error) {
      console.error('Haulam Get Rate Error Details:', error.response?.data || error.message);

      const haulamError = error.response?.data;
      const detailedMessage =
        getFirstPresentValue(haulamError, ['message', 'error', 'detail']) ||
        error.message;

      throw new Error(`Haulam Rate Error: ${detailedMessage}`);
    }
  },

  async createShipment({
    originAddress,
    destinationAddress,
    shipper,
    receiver,
    packages,
    serviceType,
  }) {
    try {
      const config = getHaulamConfig();

      if (!config.secretKey) {
        throw new Error('Haulam Shipment Error: HAULAM_SECRET_KEY is missing');
      }

      const url = `${config.baseUrl}/shipments`;
      const payload = {
        originAddress,
        destinationAddress,
        serviceType: serviceType || config.serviceType,
        shipper,
        receiver,
        packages: packages.map((pkg) => ({
          weight: pkg.weight,
          length: pkg.length,
          width: pkg.width,
          height: pkg.height,
          description: pkg.description || 'Oosri order package',
          value: pkg.value || 0,
        })),
      };

      const response = await axios.post(url, payload, {
        headers: getHeaders(config.secretKey),
        timeout: HAULAM_TIMEOUT_MS,
      });

      return normalizeShipmentResponse(response.data, payload.serviceType);
    } catch (error) {
      console.error('Haulam Shipment Error Details:', error.response?.data || error.message);

      const haulamError = error.response?.data;
      const detailedMessage =
        getFirstPresentValue(haulamError, ['message', 'error', 'detail']) ||
        error.message;

      throw new Error(`Haulam Shipment Error: ${detailedMessage}`);
    }
  },

  parseWebhookPayload(payload) {
    const data = payload?.data || {};

    return {
      event: payload?.event || 'shipment.updated',
      shipmentId: data.id || data.shipmentId || null,
      shipmentStatus: data.status || null,
      shipmentPaymentStatus: data.paymentStatus || null,
      raw: payload,
    };
  },
};
