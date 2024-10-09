const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'canceled'],
        default: 'pending'
    },
    orderDate: { type: Date, default: Date.now },
    phoneNumber: String,
    deliveryAddress: String,
    deliveryFee: Number,
    totalProduct: Number,
    totalAmount: Number,
    paymentMethod: {
        type: String, 
        enum:['wallet', 'card', 'pod']
    },
    paymentStatus: String,
    landMark: String,
    deliveryDate: Date,
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

module.exports = mongoose.model('Order', orderSchema);
