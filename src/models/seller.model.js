const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const sellerSchema = new Schema({
    firstName: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 50
    },
    lastName: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 50
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 8
    },
    businessType: {
        type: String,
        required: true,
        enum: ['Personal', 'Corporate']
    },
    country: {
        type: String,
        required: true
    },
    profilePicture: {
        type: String
    },
})


module.exports = mongoose.model("Seller", sellerSchema);