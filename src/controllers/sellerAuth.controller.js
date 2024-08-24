const Seller = require('../models/seller.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const sendOtpEmail = require('../utils/emailService');
const moment = require('moment');
const generateOtpCode = require('../utils/generateCode');
const OtpCode = require('../models/otp.model');


const sellerAccountSignup = async (req, res) => {
    const { firstName, lastName, email, password, businessType, country } = req.body;
    let profilePicture = req.body.profilePicture;

    if (!firstName || !lastName || !email || !password || !businessType || !country) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    if (profilePicture === 'MALE') {
        profilePicture = path.join('media', 'Male_Avatar.jpg');
    } else if (profilePicture === 'FEMALE') {
        profilePicture = path.join('media', 'Female_Avatar.jpg');
    } else if (req.file) {
        profilePicture = req.file.path;
    } else {
        return res.status(400).json({ message: 'Profile picture is required' });
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

        const generatedCode = generateOtpCode(6);
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

const resendOtpCode = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        const existingOtpCode = await OtpCode.findOne({ email });
        if (!existingOtpCode) {
            return res.status(404).json({ message: 'Otp code not found' });
        }

        const generatedCode = generateOtpCode(6);
        const expiration = moment().add(10, 'minutes').toDate();

        existingOtpCode.code = generatedCode;
        existingOtpCode.expiration = expiration;

        await existingOtpCode.save();

        sendOtpEmail(email, generatedCode)

        return res.status(200).json({ status: 200, success: true, message: 'Otp code resent successfully' });
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

        await Seller.updateOne({ email }, { isVerified: true });
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

        if (!existingSeller.isVerified) {
            return res.status(401).json({ message: 'Seller account not verified' });
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


const sellerBusinessRegistration = async (req, res) => {
    const { businessType } = req.seller;

    try {
        const existingSeller = await Seller.findOne({ email: req.seller.email });
        if (!existingSeller) {
            return res.status(409).json({ message: 'Seller not found' });
        }

        if (businessType === 'Personal') {
            const { dateOfBirth, residentialAddress } = req.body;
            const file = req.files ? req.files['countryIdentificationCard'] : null;

            if (!dateOfBirth || !residentialAddress) {
                return res.status(400).json({ message: 'All fields for Personal Business Account are required' });
            }

            if (!file || file.length === 0) {
                return res.status(400).json({ message: 'Country Identification Card is required' });
            }

            existingSeller.personalBusinessAccount = {
                dateOfBirth,
                residentialAddress,
                countryIdentificationCard: file[0].path
            };
        } else if (businessType === 'Corporate') {
            const { companyName, companyAddress, vatNumber, companyRegNum, paymentMethod, bankDetails } = req.body;
            const files = req.files;

            if (!companyName || !companyAddress || !vatNumber || !companyRegNum || !paymentMethod) {
                return res.status(400).json({ message: 'All fields for Corporate Business Account are required' });
            }

            if (!files || !files['vatCertificate'] || !files['companyCertificate']) {
                return res.status(400).json({ message: 'VAT and Company Certificate are required' });
            }

            if (!bankDetails.bank || !bankDetails.accountName || !bankDetails.accountNumber) {
                return res.status(400).json({ message: 'All bank details (bank, account name, account number) are required' });
            }

            existingSeller.corporateBusinessAccount = {
                companyName,
                companyAddress,
                vatNumber,
                vatCertificate: files['vatCertificate'][0].path,
                companyCertificate: files['companyCertificate'][0].path,
                companyRegNum,
                paymentMethod,
                bankDetails: {
                    bank: bankDetails.bank,
                    accountName: bankDetails.accountName,
                    accountNumber: bankDetails.accountNumber
                }
            };
        } else {
            return res.status(400).json({ message: 'Invalid business type' });
        }

        await existingSeller.save()

        const seller = { ...existingSeller._doc }
        delete seller.password;

        return res.status(201).json({ status: 201, success: true, message: 'Seller business registered successfully', data: seller });
    } catch (error) {
        return res.status(500).json({ status: 500, success: false, message: 'Internal server error', error: error.message })
    }
}


const userProfile = async (req, res) => {
    const { sellerId } = req.params;

    if (!sellerId) {
        return res.status(400).json({ message: 'Seller ID is required' });
    }

    try {
        const existingSeller = await Seller.findById(sellerId);
        if (!existingSeller) {
            return res.status(404).json({ message: 'Seller Profile not found' });
        }

        const seller = { ...existingSeller._doc }
        delete seller.password;

        return res.status(200).json({ status: 200, success: true, message: 'Seller profile fetched successfully', data: seller });
    } catch (error) {
        return res.status(500).json({ status: 500, success: false, message: 'Internal server error', error: error.message })
    }
}



module.exports = {
    sellerAccountSignup,
    resendOtpCode,
    validateOtpCode,
    sellerAccountSignin,
    sellerBusinessRegistration,
    userProfile
};