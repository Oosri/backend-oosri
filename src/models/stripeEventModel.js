const mongoose = require('mongoose');

const StripeEventSchema = new mongoose.Schema({
    eventId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    type: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['processed', 'failed'],
        default: 'processed'
    },
    processedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('StripeEvent', StripeEventSchema);
