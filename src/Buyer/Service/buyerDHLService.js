const axios = require('axios');
const constants = require('../constants');

const DHL_API_BASE_URL = process.env.DHL_API_BASE_URL;
const DHL_API_USERNAME = process.env.DHL_API_USERNAME;
const DHL_API_PASSWORD = process.env.DHL_API_PASSWORD;
const DHL_EXPORT_ACCOUNT = process.env.DHL_EXPORT_ACCOUNT;

// Helper function to remove empty strings from objects
// DHL API requires optional fields to either be omitted or have minLength: 1
const removeEmptyStrings = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(removeEmptyStrings);
  }

  if (obj !== null && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === '') {
        // Skip empty strings
        continue;
      } else if (typeof value === 'object' && value !== null) {
        // Recursively clean nested objects
        cleaned[key] = removeEmptyStrings(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  return obj;
};

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
        timeout: 10000, // 10s timeout
      });

      return response.data;
    } catch (error) {
      console.error('DHL Address Validation Error:', error.response?.data || error.message);

      // Extract specific error details from DHL if available
      const dhlError = error.response?.data;
      const errorMessage = dhlError?.detail || dhlError?.title || error.message;

      throw new Error(`DHL Validation Error: ${errorMessage}`);
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

      // Clean empty strings from address details (DHL requires minLength: 1 for optional fields)
      const cleanedShipperDetails = removeEmptyStrings(shipperDetails);
      const cleanedReceiverDetails = removeEmptyStrings(receiverDetails);

      const payload = {
        plannedShippingDateAndTime,
        // Don't hardcode productCode - let DHL return all available products
        unitOfMeasurement: 'metric',
        isCustomsDeclarable: true,
        ...(DHL_EXPORT_ACCOUNT && {
          accounts: [
            {
              number: DHL_EXPORT_ACCOUNT,
              typeCode: 'shipper',
            },
          ],
        }),
        customerDetails: {
          shipperDetails: cleanedShipperDetails,
          receiverDetails: cleanedReceiverDetails,
        },
        packages,
      };

      // Debug logging
      console.log('DHL API Configuration:');
      console.log('- Base URL:', DHL_API_BASE_URL);
      console.log('- Username:', DHL_API_USERNAME ? '***SET***' : 'MISSING');
      console.log('- Password:', DHL_API_PASSWORD ? '***SET***' : 'MISSING');
      console.log('- Account Number:', DHL_EXPORT_ACCOUNT);
      console.log('DHL Rate Request Payload:', JSON.stringify(payload, null, 2));

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

      // Clean empty strings from customer details (DHL requires minLength: 1 for optional fields)
      const cleanedCustomerDetails = removeEmptyStrings(customerDetails);

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
              addressLine1: cleanedCustomerDetails.shipperDetails.postalAddress.addressLine1,
              postalCode: cleanedCustomerDetails.shipperDetails.postalAddress.postalCode,
              cityName: cleanedCustomerDetails.shipperDetails.postalAddress.cityName,
              ...(cleanedCustomerDetails.shipperDetails.postalAddress.countyName && { countyName: cleanedCustomerDetails.shipperDetails.postalAddress.countyName }),
              countryCode: cleanedCustomerDetails.shipperDetails.postalAddress.countryCode,
            },
            contactInformation: {
              fullName: cleanedCustomerDetails.shipperDetails.contactInformation.fullName,
              companyName: cleanedCustomerDetails.shipperDetails.contactInformation.companyName,
              email: cleanedCustomerDetails.shipperDetails.contactInformation.email,
              phone: cleanedCustomerDetails.shipperDetails.contactInformation.phone,
            },
          },
          receiverDetails: {
            postalAddress: {
              addressLine1: cleanedCustomerDetails.receiverDetails.postalAddress.addressLine1,
              postalCode: cleanedCustomerDetails.receiverDetails.postalAddress.postalCode,
              cityName: cleanedCustomerDetails.receiverDetails.postalAddress.cityName,
              ...(cleanedCustomerDetails.receiverDetails.postalAddress.countyName && { countyName: cleanedCustomerDetails.receiverDetails.postalAddress.countyName }),
              countryCode: cleanedCustomerDetails.receiverDetails.postalAddress.countryCode,
            },
            contactInformation: {
              fullName: cleanedCustomerDetails.receiverDetails.contactInformation.fullName,
              companyName: cleanedCustomerDetails.receiverDetails.contactInformation.companyName,
              email: cleanedCustomerDetails.receiverDetails.contactInformation.email,
              phone: cleanedCustomerDetails.receiverDetails.contactInformation.phone,
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