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
},

 

async schedulePickup({
  plannedPickupDateAndTime,
  closeTime,
  location,
  locationType,
  customerDetails,
  shipmentDetails, 
}) {
  try {
    const url = `${DHL_API_BASE_URL}/pickups`;

    console.log('Scheduling DHL Pickup with data:', {
      plannedPickupDateAndTime,
      closeTime,
      location,
      locationType,
      customerDetails,
      shipmentDetails,
    });

    const payload = {
      plannedPickupDateAndTime,
      closeTime: closeTime || '17:00',
      location: location || 'Reception Area',
      locationType: locationType || 'business',
      accounts: [
        {
          number: DHL_EXPORT_ACCOUNT,
          typeCode: 'shipper',
        },
      ],
      specialInstructions: [
        {
          value: 'Handle with care',
          typeCode: 'TBD',
        },
      ],

      customerDetails: {
        shipperDetails: {
          postalAddress: {
            addressLine1: customerDetails.shipperDetails.postalAddress.addressLine1,
            postalCode: customerDetails.shipperDetails.postalAddress.postalCode,
            cityName: customerDetails.shipperDetails.postalAddress.cityName,
            countyName: customerDetails.shipperDetails.postalAddress.countyName || '',
            countryCode: customerDetails.shipperDetails.postalAddress.countryCode,
          },
          contactInformation: {
            fullName: customerDetails.shipperDetails.contactInformation.fullName,
            companyName: customerDetails.shipperDetails.contactInformation.companyName,
            email: customerDetails.shipperDetails.contactInformation.email,
            phone: customerDetails.shipperDetails.contactInformation.phone,
          },
        },
        receiverDetails: {
          postalAddress: {
            addressLine1: customerDetails.receiverDetails.postalAddress.addressLine1,
            postalCode: customerDetails.receiverDetails.postalAddress.postalCode,
            cityName: customerDetails.receiverDetails.postalAddress.cityName,
            countyName: customerDetails.receiverDetails.postalAddress.countyName || '',
            countryCode: customerDetails.receiverDetails.postalAddress.countryCode,
          },
          contactInformation: {
            fullName: customerDetails.receiverDetails.contactInformation.fullName,
            companyName: customerDetails.receiverDetails.contactInformation.companyName,
            email: customerDetails.receiverDetails.contactInformation.email,
            phone: customerDetails.receiverDetails.contactInformation.phone,
          },
        },
      },

      shipmentDetails: shipmentDetails.map((shipment) => ({
        productCode: shipment.productCode || 'P',
        isCustomsDeclarable:
          shipment.isCustomsDeclarable !== undefined
            ? shipment.isCustomsDeclarable
            : true,
        declaredValue: shipment.declaredValue || 250000,
        declaredValueCurrency: shipment.declaredValueCurrency || 'NGN',
        unitOfMeasurement: shipment.unitOfMeasurement || 'metric',
        packages: shipment.packages.map((pkg) => ({
          weight: pkg.weight,
          dimensions: {
            length: pkg.dimensions.length,
            width: pkg.dimensions.width,
            height: pkg.dimensions.height,
          },
        })),
      })),
    };

    const response = await axios.post(url, payload, {
      auth: {
        username: DHL_API_USERNAME,
        password: DHL_API_PASSWORD,
      },
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });


    const data = response.data;
    return {
      pickupConfirmationNumber: data.pickupConfirmationNumber,
      readyByTime: data.readyByTime,
      nextPickupCutoffTime: data.nextPickupCutoffTime,
      warning: data.warning || null,
      details: data,
    };
  } catch (error) {
    console.error('DHL Pickup Error:', error.response?.data || error.message);
    throw new Error(
      error.response?.data?.detail || 'Unable to schedule DHL pickup'
    );
  }
}



};