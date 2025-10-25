const axios = require('axios');
const constants = require('../constants');

const DHL_API_BASE_URL = process.env.DHL_API_BASE_URL;
const DHL_API_USERNAME = process.env.DHL_API_USERNAME;
const DHL_API_PASSWORD = process.env.DHL_API_PASSWORD;
const DHL_EXPORT_ACCOUNT = process.env.DHL_EXPORT_ACCOUNT;

module.exports = {


  async validateAddress({ countryCode, cityName, postalCode }) {
    try {

       if (!countryCode || !cityName || !postalCode) {
     
        throw new Error(constants.shippingRateMessages.REQUIRED_FIELDS_MISSING);
    }

      const url = `${DHL_API_BASE_URL}/address-validate`;

      const response = await axios.get(url, {
        params: {
          type: 'delivery',
          countryCode,
          postalCode,
          cityName,
          strictValidation: true,
        },
        auth: {
          username: DHL_API_USERNAME,
          password: DHL_API_PASSWORD,
        },
        headers: {
          Accept: 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      console.error('DHL Address Validation Error:', error.response?.data || error.message);
      throw new Error('Unable to validate address with DHL');
    }
  },

  async getDeliveryRate({
  plannedShippingDateAndTime,
  shipperDetails,
  receiverDetails,
  packages,
}) {
  try {
    const url = `${DHL_API_BASE_URL}/rates`;

    const payload = {
      plannedShippingDateAndTime,
      productCode: 'P',
      unitOfMeasurement: 'metric',
      isCustomsDeclarable: true,
      nextBusinessDay: true,
      accounts: [
        {
          number: DHL_EXPORT_ACCOUNT,
          typeCode: 'shipper',
        },
      ],
      customerDetails: {
        shipperDetails,
        receiverDetails,
      },
      packages,
    };

    const response = await axios.post(url, payload, {
      auth: {
        username: DHL_API_USERNAME,
        password: DHL_API_PASSWORD,
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const data = response.data;

    const firstProduct = data.products?.[0];
    const exchange = data.exchangeRates?.[0];

    if (!firstProduct) {
      throw new Error('No products returned from DHL.');
    }

    const summary = {
      product: firstProduct.productName,
      productCode: firstProduct.productCode,
      currency: firstProduct.totalPrice?.[0]?.priceCurrency,
      totalPrice: firstProduct.totalPrice?.[0]?.price,
      estimatedDeliveryDate: firstProduct.deliveryCapabilities?.estimatedDeliveryDateAndTime,
      totalTransitDays: firstProduct.deliveryCapabilities?.totalTransitDays,
      originServiceArea: firstProduct.deliveryCapabilities?.originServiceAreaCode || firstProduct.pickupCapabilities?.originServiceAreaCode,
      destinationServiceArea: firstProduct.deliveryCapabilities?.destinationServiceAreaCode,
      exchangeRate: exchange
        ? {
            from: exchange.baseCurrency,
            to: exchange.currency,
            rate: exchange.currentExchangeRate,
          }
        : null,
    };

    return summary;
  } catch (error) {
    console.error('DHL Get Rate Error:', error.response?.data || error.message);
    throw new Error('Unable to fetch delivery rate from DHL');
  }
}

};