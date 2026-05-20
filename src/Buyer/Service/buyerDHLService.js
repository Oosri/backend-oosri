const axios = require('axios');
const constants = require('../constants');

// Move environment variables inside methods to ensure they are read AFTER dotenv.config()
// even if the module is loaded early.
const getDHLConfig = () => ({
  baseUrl: process.env.DHL_API_BASE_URL,
  username: process.env.DHL_API_USERNAME,
  password: process.env.DHL_API_PASSWORD,
  exportAccount: process.env.DHL_EXPORT_ACCOUNT
});

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

      const config = getDHLConfig();
      if (!config.baseUrl) {
        throw new Error('DHL Rate Error: Invalid URL (DHL_API_BASE_URL is missing)');
      }

      const url = `${config.baseUrl}/address-validate`;

      const response = await axios.get(url, {
        params: {
          type: 'delivery',
          countryCode,
          postalCode,
          cityName,
          strictValidation: true,
        },
        auth: {
          username: config.username,
          password: config.password,
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
      const config = getDHLConfig();
      const url = `${config.baseUrl}/rates`;

      // Clean empty strings from address details (DHL requires minLength: 1 for optional fields)
      const cleanedShipperDetails = removeEmptyStrings(shipperDetails);
      const cleanedReceiverDetails = removeEmptyStrings(receiverDetails);

      const payload = {
        plannedShippingDateAndTime,
        // Don't hardcode productCode - let DHL return all available products
        unitOfMeasurement: 'metric',
        isCustomsDeclarable: true,
        ...(config.exportAccount && {
          accounts: [
            {
              number: config.exportAccount,
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

      let response;
      const requestOptions = {
        auth: {
          username: config.username,
          password: config.password,
        },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30s timeout
      };

      try {
        response = await axios.post(url, payload, requestOptions);
      } catch (error) {
        // DHL returns 400/500 code with specific detail.
        const dhlError = error.response?.data;
        const errorDetail = dhlError?.detail || dhlError?.title || '';
        
        // If the error is related to Account Restrictions (e.g. Error 8003) 
        // fallback to public (published) rates to avoid breaking the checkout flow.
        const isAccountError = String(errorDetail).includes('8003') || String(errorDetail).toLowerCase().includes('account');
        
        if (payload.accounts && isAccountError) {
          console.warn(`[DHL Auto-Fallback]: Account validation failed (${errorDetail}). Retrying for public rates...`);
          
          // Remove the accounts array from payload to fetch public/retail rates instead
          delete payload.accounts;
          
          response = await axios.post(url, payload, requestOptions);
        } else {
          // If it's a different error (e.g. invalid address), throw up to outer catch
          throw error;
        }
      }

      const data = response.data;

      if (!data.products || data.products.length === 0) {
        throw new Error('No products returned from DHL.');
      }

      // Find the cheapest product
      // We look for the price in the declared currency or falls back to NGN/USD
      const productsWithPrice = data.products.map(p => {
        const priceObj = p.totalPrice?.find(tp => tp.priceCurrency === 'NGN' || tp.priceCurrency === 'USD') || p.totalPrice?.[0];
        return {
          ...p,
          sortPrice: priceObj ? priceObj.price : Number.MAX_VALUE
        };
      });

      // Sort by price ascending
      productsWithPrice.sort((a, b) => a.sortPrice - b.sortPrice);

      const firstProduct = productsWithPrice[0];
      const exchange = data.exchangeRates?.[0];

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
      console.error('DHL Get Rate Error Details:', error.response?.data || error.message);

      const dhlError = error.response?.data;
      const detailedMessage = dhlError?.detail || dhlError?.title || error.message;

      throw new Error(`DHL Rate Error: ${detailedMessage}`);
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
      const config = getDHLConfig();
      const url = `${config.baseUrl}/pickups`;

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
            number: config.exportAccount,
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
              ...(cleanedCustomerDetails.shipperDetails.postalAddress.addressLine2 && { addressLine2: cleanedCustomerDetails.shipperDetails.postalAddress.addressLine2 }),
              ...(cleanedCustomerDetails.shipperDetails.postalAddress.addressLine3 && { addressLine3: cleanedCustomerDetails.shipperDetails.postalAddress.addressLine3 }),
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
              ...(cleanedCustomerDetails.receiverDetails.postalAddress.addressLine2 && { addressLine2: cleanedCustomerDetails.receiverDetails.postalAddress.addressLine2 }),
              ...(cleanedCustomerDetails.receiverDetails.postalAddress.addressLine3 && { addressLine3: cleanedCustomerDetails.receiverDetails.postalAddress.addressLine3 }),
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
          username: config.username,
          password: config.password,
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