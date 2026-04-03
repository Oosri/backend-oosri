require('dotenv').config();
const mongoose = require('mongoose');
const buyerShippingService = require('./src/Buyer/Service/buyerShippingService');

async function testCalculate() {
    try {
        const deliveryAddress = {
            address: '100 Allen Avenue',
            cityName: 'Ikeja',
            postalCode: '100281',
            countryCode: 'NG',
            countryName: 'Nigeria'
        };

        const sellers = [
            {
                sellerId: 'seller1',
                items: [
                    { productId: new mongoose.Types.ObjectId(), quantity: 1 }
                ]
            }
        ];

        const products = [
            {
                _id: sellers[0].items[0].productId,
                weight: 10,
                dimensions: { length: 12, width: 12, height: 12 }
            }
        ];

        console.log('Testing calculateConsolidatedShipping...');
        const result = await buyerShippingService.calculateConsolidatedShipping(
            deliveryAddress,
            sellers,
            products
        );

        console.log('Success! Final Rate:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Test Error:', err.message);
    } finally {
        process.exit(0);
    }
}

testCalculate();
