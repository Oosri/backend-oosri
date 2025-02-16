const Seller = require('../models/sellerModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const moment = require('moment');
const generateOtpCode = require('../utils/generateCode');
const OtpCode = require('../models/otpModel');
const sendEmail = require('../utils/emailService');
const passwordResetCode = require('../utils/emailService');
const fs = require('fs');
const ftpClient = require('basic-ftp');
const { Readable } = require('stream');

const sellerAccountSignup = async (req, res) => {
  const { firstName, lastName, email, password, businessType, country } =
    req.body;
  let profilePicture = req.body.profilePicture;
  const file = req.file;

  const requiredFields = {
    firstName,
    lastName,
    email,
    password,
    businessType,
    country
  };
  const missingFields = Object.entries(requiredFields).filter(
    ([key, value]) => !value
  );
  if (missingFields.length) {
    return res.status(400).json({
      message: `The following fields are required: ${missingFields
        .map(([key]) => key)
        .join(', ')}`
    });
  }

  const client = new ftpClient.Client();
  client.ftp.verbose = true;

  const avatarMap = {
    Avatar1: 'profile_pictures/Avatar1.jpg',
    Avatar2: 'profile_pictures/Avatar2.jpg',
    Avatar3: 'profile_pictures/Avatar3.jpg',
    Avatar4: 'profile_pictures/Avatar4.jpg',
    Avatar5: 'profile_pictures/Avatar5.jpg',
    Avatar6: 'profile_pictures/Avatar6.jpg',
    Avatar7: 'profile_pictures/Avatar7.jpg',
    Avatar8: 'profile_pictures/Avatar8.jpg',
    Avatar9: 'profile_pictures/Avatar9.jpg',
    Avatar10: 'profile_pictures/Avatar10.jpg',
    Avatar11: 'profile_pictures/Avatar11.jpg'
  };

  if (avatarMap[profilePicture]) {
    profilePicture = `https://${process.env.FTP_HOST}/${avatarMap[profilePicture]}`;
  } else if (file) {
    try {
      await client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: false,
        port: process.env.FTP_PORT || 21
      });

      const uniqueFileName = `${Date.now()}-${file.originalname}`;
      const remoteFilePath = `/public_html/profile_pictures/${uniqueFileName}`;

      const stream = new Readable();
      stream.push(file.buffer);
      stream.push(null);

      await client.uploadFrom(stream, remoteFilePath);
      profilePicture = `https://${process.env.FTP_HOST}/profile_pictures/${uniqueFileName}`;
    } catch (ftpError) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error uploading profile picture to FTP',
        error: ftpError.message
      });
    } finally {
      client.close();
    }
  } else {
    return res.status(400).json({ message: 'Profile picture is required' });
  }

  try {
    const existingSeller = await Seller.findOne({ email });
    if (existingSeller) {
      if (!existingSeller.isVerified) {
        existingSeller.firstName = firstName;
        existingSeller.lastName = lastName;
        existingSeller.email = email;
        existingSeller.password = password;
        existingSeller.businessType = businessType;
        existingSeller.country = country;
        existingSeller.profilePicture = profilePicture;

        await existingSeller.save();

        const generatedCode = generateOtpCode(4);
        const otpArray = generatedCode.split('');
        const expiration = moment().add(10, 'minutes').toDate();

        const otpEntry = await OtpCode.findOne({ email });

        if (otpEntry) {
          otpEntry.code = generatedCode;
          otpEntry.expiration = expiration;
          await otpEntry.save();
          console.log('OTP code updated successfully');
        } else {
          const newOtpCode = new OtpCode({
            email,
            code: generatedCode,
            expiration
          });
          await newOtpCode.save();
          console.log('OTP code inserted successfully');
        }
        sendEmail.sendOtpEmail(email, otpArray, existingSeller.firstName);

        const token = jwt.sign(
          { sellerId: existingSeller._id },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        return res.status(200).json({
          status: 200,
          success: true,
          message:
            'An Otp Code has been sent to your email for account verification',
          data: { token }
        });
      }
      return res
        .status(409)
        .json({ message: 'Seller account already exists and is verified' });
    }

    const SALT_ROUND = parseInt(process.env.SALT_ROUNDS, 10);
    if (isNaN(SALT_ROUND)) {
      return res.status(500).json('Invalid SALT_ROUNDS environment variable');
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
      isVerified: false,
      sellerStatus: 'Unverified'
    });

    const token = jwt.sign(
      { sellerId: newSeller._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await newSeller.save();

    const seller = { ...newSeller._doc };
    delete seller.password;

    const generatedCode = generateOtpCode(4);
    const otpArray = generatedCode.split('');
    const expiration = moment().add(10, 'minutes').toDate();

    const otpEntry = await OtpCode.findOne({ email });

    if (otpEntry) {
      otpEntry.code = generatedCode;
      otpEntry.expiration = expiration;
      await otpEntry.save();
    } else {
      const newOtpCode = new OtpCode({
        email,
        code: generatedCode,
        expiration
      });
      await newOtpCode.save();
    }

    sendEmail.sendOtpEmail(email, otpArray, firstName);

    return res.status(201).json({
      status: 201,
      success: true,
      message: 'An OTP Code has been sent to your email',
      data: seller,
      token
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const resendOtpCode = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const existingSeller = await Seller.findOne({ email });

    if (!existingSeller) {
      return res.status(400).json({ message: 'Seller account does not exist' });
    }

    const generatedCode = generateOtpCode(6);
    const otpArray = generatedCode.split('');
    const expiration = moment().add(10, 'minutes').toDate();

    await OtpCode.updateOne(
      { email },
      { $set: { code: generatedCode, expiration: expiration } },
      { upsert: true }
    );

    sendEmail.sendOtpEmail(email, otpArray, existingSeller.firstName);

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Otp code resent successfully'
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const validateOtpCode = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: 'Email and code are required' });
  }

  try {
    const sellerOtpCode = await OtpCode.findOne({ email });
    if (!sellerOtpCode) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (sellerOtpCode.expiration < new Date()) {
      await OtpCode.deleteOne({ email });
      return res.status(400).json({ message: 'Otp code has expired' });
    }

    if (sellerOtpCode.code !== code) {
      return res.status(400).json({ message: 'Invalid otp code' });
    }

    await Seller.updateOne({ email }, { isVerified: true });
    await OtpCode.deleteOne({ email });

    const sellerInfo = await Seller.findOne({ email });
    if (!sellerInfo) {
      return res
        .status(404)
        .json({ message: 'Seller not found after verification' });
    }

    const token = jwt.sign(
      { sellerId: sellerInfo._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const seller = { ...sellerInfo._doc };
    delete seller.password;

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Otp code validated successfully',
      data: seller,
      token
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

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

    const isPasswordValid = await bcrypt.compare(
      password,
      existingSeller.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid Email/Password' });
    }

    const token = jwt.sign(
      { sellerId: existingSeller._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const seller = { ...existingSeller._doc };
    delete seller.password;

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Seller account signed in successfully',
      data: seller,
      token
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const sellerForgetPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const existingSeller = await Seller.findOne({ email });

    if (!existingSeller) {
      return res.status(400).json({ message: 'Seller account does not exist' });
    }

    const resetCode = generateOtpCode(6);
    const otpArray = resetCode.split('');
    const expiration = moment().add(10, 'minutes').toDate();

    await OtpCode.updateOne(
      { email },
      { $set: { code: resetCode, expiration: expiration } },
      { upsert: true }
    );

    sendEmail.passwordResetCode(email, otpArray, existingSeller.firstName);

    return res.status(201).json({
      message: 'An OTP Code has been sent to your mail',
      status: 200,
      success: true
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const sellerResetPassword = async (req, res) => {
  const { code, newPassword, confirmPassword } = req.body;

  try {
    const passwordReset = await OtpCode.findOne({
      code,
      expiration: { $gt: new Date() }
    });

    if (!passwordReset) {
      return res
        .status(500)
        .json({ message: 'Invalid or expired recovery code' });
    }

    const existingSeller = await Seller.findOne({ email: passwordReset.email });

    if (!existingSeller) {
      return res.status(400).json({ message: 'Seller not found' });
    }

    if (newPassword === existingSeller.password) {
      return res.status(400).json({
        message: 'New password must be different from the old password'
      });
    }

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ message: 'Password and confirm password do not match' });
    }

    const SALT_ROUND = parseInt(process.env.SALT_ROUNDS, 10);
    if (isNaN(SALT_ROUND)) {
      return res.status(500).json('Invalid SALT_ROUNDS environment variable');
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUND);
    existingSeller.password = hashedPassword;

    await OtpCode.deleteOne({ code });

    await existingSeller.save();

    const seller = { ...existingSeller._doc };
    delete seller.password;

    return res.status(200).json({
      message: 'Password reset successful and user logged in',
      data: seller,
      status: 200,
      success: true
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const sellerBusinessRegistration = async (req, res) => {
  const { bankDetails } = req.body;
  const { businessType } = req.seller;
  const client = new ftpClient.Client();
  client.ftp.verbose = true;

  if (
    !bankDetails ||
    !bankDetails.bank ||
    !bankDetails.accountName ||
    !bankDetails.accountNumber
  ) {
    return res.status(400).json({
      message:
        'All bank details (bank, account name, account number) are required'
    });
  }

  try {
    const existingSeller = await Seller.findOne({ email: req.seller.email });
    if (!existingSeller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    existingSeller.bankDetails = {
      bank: bankDetails.bank,
      accountName: bankDetails.accountName,
      accountNumber: bankDetails.accountNumber
    };

    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: false,
      port: process.env.FTP_PORT || 21
    });

    const remoteDirPath = '/public_html/seller_docs/';
    await client.ensureDir(remoteDirPath);

    if (businessType === 'Personal') {
      const { dateOfBirth, residentialAddress } = req.body;
      const file = req.files ? req.files['countryIdentificationCard'] : null;

      if (!dateOfBirth || !residentialAddress) {
        return res.status(400).json({
          message: 'All fields for Personal Business Account are required'
        });
      }

      if (!file || file.length === 0) {
        return res
          .status(400)
          .json({ message: 'Country Identification Card is required' });
      }

      const uniqueFileName = `${Date.now()}-${file[0].originalname}`;
      const remoteFilePath = `${remoteDirPath}${uniqueFileName}`;
      const stream = new Readable();
      stream.push(file[0].buffer);
      stream.push(null);

      try {
        await client.uploadFrom(stream, remoteFilePath);
      } catch (uploadError) {
        return res.status(500).json({
          message: 'File upload failed',
          error: uploadError.message
        });
      }

      existingSeller.personalBusinessAccount = {
        dateOfBirth,
        residentialAddress,
        countryIdentificationCard: `https://${process.env.FTP_HOST}/seller_docs/${uniqueFileName}`
      };
    } else if (businessType === 'Corporate') {
      const {
        companyName,
        companyAddress,
        vatNumber,
        companyRegNum,
        paymentMethod
      } = req.body;
      const files = req.files;

      if (
        !companyName ||
        !companyAddress ||
        !vatNumber ||
        !companyRegNum ||
        !paymentMethod
      ) {
        return res.status(400).json({
          message: 'All fields for Corporate Business Account are required'
        });
      }

      if (!files || !files['vatCertificate'] || !files['companyCertificate']) {
        return res
          .status(400)
          .json({ message: 'VAT and Company Certificate are required' });
      }

      const vatCertificateFileName = `${Date.now()}-${
        files['vatCertificate'][0].originalname
      }`;
      const vatRemoteFilePath = `${remoteDirPath}${vatCertificateFileName}`;

      const vatStream = new Readable();
      vatStream.push(files['vatCertificate'][0].buffer);
      vatStream.push(null);

      try {
        await client.uploadFrom(vatStream, vatRemoteFilePath);
      } catch (uploadError) {
        return res.status(500).json({
          message: 'VAT Certificate upload failed',
          error: uploadError.message
        });
      }

      const companyCertificateFileName = `${Date.now()}-${
        files['companyCertificate'][0].originalname
      }`;
      const companyRemoteFilePath = `${remoteDirPath}${companyCertificateFileName}`;

      const companyStream = new Readable();
      companyStream.push(files['companyCertificate'][0].buffer);
      companyStream.push(null);

      try {
        await client.uploadFrom(companyStream, companyRemoteFilePath);
      } catch (uploadError) {
        return res.status(500).json({
          message: 'Company Certificate upload failed',
          error: uploadError.message
        });
      }

      existingSeller.corporateBusinessAccount = {
        companyName,
        companyAddress,
        vatNumber,
        vatCertificate: `https://${process.env.FTP_HOST}/seller_docs/${vatCertificateFileName}`,
        companyCertificate: `https://${process.env.FTP_HOST}/seller_docs/${companyCertificateFileName}`,
        companyRegNum,
        paymentMethod
      };
    } else {
      return res.status(400).json({ message: 'Invalid business type' });
    }

    await existingSeller.save();

    const seller = { ...existingSeller._doc };
    delete seller.password;

    return res.status(201).json({
      status: 201,
      success: true,
      message: 'Seller business registered successfully',
      data: seller
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  } finally {
    client.close();
  }
};

const userProfile = async (req, res) => {
  try {
    const existingSeller = await Seller.findById(req.seller);
    if (!existingSeller) {
      return res.status(404).json({ message: 'Seller Profile not found' });
    }

    const seller = { ...existingSeller._doc };
    delete seller.password;

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Seller profile fetched successfully',
      data: seller
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  sellerAccountSignup,
  resendOtpCode,
  validateOtpCode,
  sellerAccountSignin,
  sellerForgetPassword,
  sellerResetPassword,
  sellerBusinessRegistration,
  userProfile
};
