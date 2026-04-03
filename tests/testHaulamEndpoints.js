require('dotenv').config();
const buyerHaulamService = require('../src/Buyer/Service/buyerHaulamService');

async function testGetDeliveryRate() {
  console.log('\n--- Testing getDeliveryRate with Doc Addresses ---');
  const shipperDetails = {
    addressLine1: '123 Main St',
    cityName: 'New York',
    countyName: 'NY',
    countryName: 'USA',
  };

  const receiverDetails = {
    addressLine1: '100 Allen Avenue',
    addressLine2: 'Ikeja',
    cityName: 'Lagos',
    countryName: 'Nigeria',
  };

  const packages = [
    {
      weight: 10,
      dimensions: { length: 12, width: 12, height: 12 },
      description: 'Box of clothes',
      value: 20000,
    },
  ];

  try {
    const rate = await buyerHaulamService.getDeliveryRate({
      shipperDetails,
      receiverDetails,
      packages,
    });
    console.log('Success: Rate retrieved');
    console.log(JSON.stringify(rate, null, 2));
    return rate;
  } catch (error) {
    console.error('Error in getDeliveryRate:', error.message);
    return null;
  }
}

async function testShipmentFlow(serviceType) {
  console.log(`\n--- Testing Shipment Flow with serviceType: ${serviceType} ---`);
  
  // 1. Create
  const originAddress = '123 Main St, New York, NY, USA';
  const destinationAddress = '100 Allen Avenue, Ikeja, Lagos, Nigeria';
  const shipper = {
    name: 'Jane Doe',
    phone: '+1234567890',
    email: 'jane@example.com',
  };
  const receiver = {
    name: 'John Smith',
    phone: '+2348012345678',
    email: 'john@example.ng',
  };
  const packages = [
    {
      weight: 10,
      length: 12,
      width: 12,
      height: 12,
      description: 'Personal items',
      value: 25000,
    },
  ];

  let shipmentId;
  try {
    const shipment = await buyerHaulamService.createShipment({
      originAddress,
      destinationAddress,
      shipper,
      receiver,
      packages,
      serviceType,
    });
    console.log('Success: Shipment created');
    console.log(JSON.stringify(shipment, null, 2));
    shipmentId = shipment.shipmentId;
  } catch (error) {
    console.error('Error in createShipment:', error.message);
    return;
  }

  // 2. Get Details
  if (shipmentId) {
    console.log(`\n--- Testing getShipmentDetails for ${shipmentId} ---`);
    try {
      const details = await buyerHaulamService.getShipmentDetails(shipmentId);
      console.log('Success: Details retrieved');
      console.log(JSON.stringify(details, null, 2));
    } catch (error) {
      console.error('Error in getShipmentDetails:', error.message);
    }
  }
}

async function runTests() {
  const balance = await buyerHaulamService.getWalletBalance();
  console.log('Wallet Balance:', balance.balance, balance.currency);

  const rate = await testGetDeliveryRate();
  if (rate) {
    await testShipmentFlow(rate.productCode);
  }
}

if (require.main === module) {
  runTests();
}
