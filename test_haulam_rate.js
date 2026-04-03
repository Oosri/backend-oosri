require('dotenv').config();
const mongoose = require('mongoose');
const buyerHaulamService = require('./src/Buyer/Service/buyerHaulamService');

async function testHaulam() {
  try {
    const shipperDetails = {
      addressLine1: '3 Close B, Unity Estate Off Alkat way',
      cityName: 'Lagos',
      postalCode: '100216',
      countyName: 'Lagos',
      countryCode: 'NG'
    };
    
    const receiverDetails = {
      addressLine1: '456 Delivery Ave',
      cityName: 'Abuja',
      postalCode: '900108',
      countyName: 'Federal Capital Territory',
      countryCode: 'NG',
      countryName: 'Nigeria'
    };

    const packages = [
      {
        weight: 1.5,
        dimensions: { length: 20, width: 20, height: 10 }
      }
    ];

    console.log('Calling getDeliveryRate...');
    const result = await buyerHaulamService.getDeliveryRate({
      shipperDetails,
      receiverDetails,
      packages
    });

    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Test Error:', err.message);
  } finally {
    process.exit(0);
  }
}

testHaulam();
