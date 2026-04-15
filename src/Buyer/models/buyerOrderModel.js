const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderStatus: {
        type: String,
        enum: ['pending', 'processing', 'pending_logistics', 'completed', 'canceled', 'on-hold'],
        default: 'pending'
    },
    orderDate: { type: Date, default: Date.now },
    phoneNumber: String,
     deliveryAddresses: [{
    address: String,
    postalCode: String,
    cityName: String,
    countryCode: String,
    countryName: String,
  }],
    deliveryFee: Number,
    shippingProvider: String,
    shippingServiceName: String,
    shippingServiceCode: String,
    estimatedDeliveryDate: String,
    shipmentId: String,
    shipmentReference: String,
    shipmentStatus: String,
    shipmentPaymentStatus: String,
    shipmentLastUpdatedAt: Date,
    totalProduct: Number,
    totalAmount: Number,
    currencyCode: { type: String, default: 'USD' },
    baseCurrency: { type: String, default: 'NGN' },
    platformFee: Number,
    sellerAmount: Number,
    paymentIntentId: String,
    paymentMethod: {
        type: String, 
        enum:['wallet', 'card', 'pod']
    },
    paymentStatus: String,
    refundAmount: { type: Number, default: 0 },
    landMark: String,
    deliveryDate: Date,
    inventoryDeducted: { type: Boolean, default: false },
    inventoryRestored: { type: Boolean, default: false },
    inventoryRestoredAt: Date,
    inventoryDeductionLog: [mongoose.Schema.Types.Mixed],
    products: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        productName: String, 
        price: Number,      
        images: [String],    
        quantity: Number,
        totalPrice: Number,
        sellerId: {  
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Seller'
        }
    }],
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Buyer',
        required: true
    },
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller'
    }
}, {
    timestamps: true,
    toObject: {
        transform: (doc, ret, options) => {
            ret.id = ret._id;
            delete ret._id;
            delete ret.createdAt;
            delete ret.updatedAt;
            delete ret.__v;
            return ret;
        }
    }
});

orderSchema.index({ 'products.productId': 1 });
orderSchema.index({ 'products.sellerId': 1 });
orderSchema.index({ sellerId: 1 });
orderSchema.index({ userId: 1, orderDate: -1 });
orderSchema.index({ userId: 1, orderStatus: 1, orderDate: -1 });
orderSchema.index({ shipmentId: 1 });
orderSchema.index({ shipmentReference: 1 });

module.exports = mongoose.model('Order', orderSchema);
