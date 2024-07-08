const Seller = require('../models/seller.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendOtpEmail = require('../utils/emailService');
const moment = require('moment');
const OtpCode = require('../models/otp.model');


const sellerAccountSignup = async (req, res) => {
    const { firstName, lastName, email, password, businessType, country, profilePicture } = req.body;

    if (!firstName || !lastName || !email || !password || !businessType || !country) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const existingSeller = await Seller.findOne({ email });
        if (existingSeller) {
            return res.status(409).json({ message: 'Seller account already exists' });
        }

        const SALT_ROUND = parseInt(process.env.SALT_ROUNDS, 10);
        if (isNaN(SALT_ROUND)) {
            return res.status(500).json('Invalid SALT_ROUNDS environment variable')
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUND);

        const newSeller = new Seller({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            businessType,
            country,
            profilePicture,
        });

        const token = jwt.sign({ sellerId: newSeller._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        await newSeller.save();

        const seller = { ...newSeller._doc }
        delete seller.password;

        const generatedCode = Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
        const expiration = moment().add(10, 'minutes').toDate();

        const otpCode = new OtpCode({
            email,
            code: generatedCode,
            expiration
        });

        await otpCode.save();

        sendOtpEmail(email, generatedCode);

        return res.status(201).json({ status: 201, success: true, message: 'An Otp Code has been sent to your email', data: seller, token });

    } catch (error) {
        return res.status(500).json({ status: 500, success: false, message: 'Internal server error', error: error.message })
    }
}


const validateOtpCode = async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ message: 'Email and code are required' });
    }

    try {
        const otp = await OtpCode.findOne({ email });
        if (!otp) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (otp.code !== code) {
            return res.status(400).json({ message: 'Invalid otp code' });
        }

        if (otp.expiration < new Date()) {
            return res.status(400).json({ message: 'Otp code has expired' });
        }

        await OtpCode.deleteOne({ email });

        return res.status(200).json({ status: 200, success: true, message: 'Otp code validated successfully' });
    } catch (error) {
        return res.status(500).json({ status: 500, success: false, message: 'Internal server error', error: error.message })
    }
}


const sellerAccountSignin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const existingSeller = await Seller.findOne({ email });
        if (!existingSeller) {
            return res.status(404).json({ message: 'Seller account not found' });
        }

        const isPasswordValid = await bcrypt.compare(password, existingSeller.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid Email/Password' });
        }

        const token = jwt.sign({ sellerId: existingSeller._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        const seller = { ...existingSeller._doc }
        delete seller.password

        return res.status(200).json({ status: 200, success: true, message: 'Seller account signed in successfully', data: seller, token });
    } catch (error) {
        return res.status(500).json({ status: 500, success: false, message: 'Internal server error', error: error.message })
    }
}

module.exports = { sellerAccountSignup, validateOtpCode, sellerAccountSignin };