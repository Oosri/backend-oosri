const proxyquire = require('proxyquire');
const assert = require('assert');

// Mock request and response objects
const req = {
    body: {
        receiverDetails: {
            addressLine1: 'Test Receiver',
            postalCode: '12345',
            cityName: 'Test City',
            countryCode: 'US'
        },
        packages: [{ weight: 1, dimensions: { length: 1, width: 1, height: 1 } }]
    }
};

const res = {
    status: (code) => ({
        json: (data) => {
            console.log('Response Status:', code);
            console.log('Response Body:', data);
            if (data.body && data.body.totalPriceUSD) {
                console.log('VERIFICATION SUCCESS: totalPriceUSD is present:', data.body.totalPriceUSD);
                if (data.body.totalPriceUSD === 11.8) {
                    console.log('VERIFICATION SUCCESS: totalPriceUSD includes markup (10.3 + 1.5 = 11.8)');
                } else {
                    console.log('VERIFICATION FAILURE: totalPriceUSD does not seem to include markup, expected 11.8');
                }
            } else {
                console.log('VERIFICATION WARNING: totalPriceUSD is missing!');
            }
        },
        send: (data) => { // fallback for send
            console.log('Response Status:', code);
            console.log('Response Body:', data);
        }
    })
};

// Expected shipper details
const EXPECTED_SHIPPER_DETAILS = {
    addressLine1: '3 Close B, Unity Estate Off Alkat way',
    cityName: 'Iju-Ishaga',
    postalCode: '100216',
    countyName: 'Lagos',
    countryCode: 'NG'
};

// Mock buyerDHLService
const buyerDHLServiceMock = {
    getDeliveryRate: async (params) => {
        console.log('Mock getDeliveryRate called with:', params);

        try {
            assert.deepStrictEqual(params.shipperDetails, EXPECTED_SHIPPER_DETAILS, 'Shipper details do not match expected values');

            // Verify date is present and looks like a date string
            if (params.plannedShippingDateAndTime && params.plannedShippingDateAndTime.includes('GMT+01:00')) {
                console.log('VERIFICATION SUCCESS: plannedShippingDateAndTime is generated:', params.plannedShippingDateAndTime);
            } else {
                throw new Error('plannedShippingDateAndTime is missing or invalid format');
            }

            console.log('VERIFICATION SUCCESS: Shipper details match expected values.');
        } catch (error) {
            console.error('VERIFICATION FAILED:', error.message);
            process.exit(1);
        }

        // Return a realistic mock response
        return {
            product: 'DHL Express Worldwide',
            productCode: 'P',
            currency: 'NGN',
            totalPrice: 15450.00,
            estimatedDeliveryDate: '2025-10-28T18:00:00',
            totalTransitDays: 2,
            originServiceArea: 'LOS',
            destinationServiceArea: 'NYC'
        };
    },
    validateAddress: async () => { }
};

// Mock fxService
const fxServiceMock = {
    convertNGNtoUSD: async (amount) => {
        console.log('Mock convertNGNtoUSD called with:', amount);
        return amount / 1500; // Mock rate 1500 NGN/USD
    }
};

// Load the controller with the mock service
const buyerDHLController = proxyquire('/home/crackeng/Documents/projects/oosri/backend-oosri/src/Buyer/controllers/buyerDHLController.js', {
    '../Service/buyerDHLService': buyerDHLServiceMock,
    '../Service/fxService': fxServiceMock,
    '../constants': {
        customServerResponse: {},
        shippingRateMessages: { RATE_RETRIEVED: 'Rate Retrieved' }
    },
    '../apiSchema/buyerDHLSchema': { getDHLPickupSchema: {} }
});

// Run the test
console.log('Running verification test...');
buyerDHLController.getDHLRate(req, res);
