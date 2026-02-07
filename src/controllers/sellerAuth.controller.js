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

const { uploadSellerProfilePicture, uploadSellerDocument } = require('../utils/cloudinary');
const { avatarMap } = require('../utils/avatarMap');
const { addImageJob } = require('../queues/image.queue');
const { addEmailJob } = require('../queues/email.queue');
const { generatePresignedUrl, validateCloudinaryUrl, extractPublicId } = require('../utils/cloudinarySignature');
const cloudinary = require('cloudinary').v2;



const sellerAccountSignup = async (req, res) => {
  const { firstName, lastName, email, password, businessType, country } =
    req.body;
  let profilePicture = req.body.profilePicture;
  const file = req.file;

  if (file) {
    console.log('Received file for signup:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path
    });
  } else {
    console.log('No file received for signup');
  }

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

  // Handle avatar selection or file upload
  let isCustomFile = false;
  if (avatarMap[profilePicture]) {
    // Use pre-uploaded avatar from Cloudinary
    profilePicture = avatarMap[profilePicture];
  } else if (file) {
    // We will upload this in the background
    isCustomFile = true;
    // Set a temporary placeholder or the default avatar while uploading
    profilePicture = avatarMap['Avatar1'] || 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg';
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
        existingSeller.isVerified = true;
        existingSeller.sellerStatus = 'Verified';

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
        // sendEmail.sendOtpEmail(email, otpArray, existingSeller.firstName);
        await addEmailJob('seller-otp', { email, otpArray, firstName: existingSeller.firstName }, { priority: 1 });

        // If it's a custom file, queue the upload job
        if (isCustomFile && file) {
          await addImageJob('seller-profile-picture', {
            sellerId: existingSeller._id,
            file: {
              path: file.path,
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size
            }
          });
        }

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
      isVerified: true,
      sellerStatus: 'Verified'
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

    // sendEmail.sendOtpEmail(email, otpArray, firstName);
    await addEmailJob('seller-otp', { email, otpArray, firstName }, { priority: 1 });

    // If it's a custom file, queue the upload job AFTER the seller is saved
    if (isCustomFile && file) {
      await addImageJob('seller-profile-picture', {
        sellerId: newSeller._id,
        file: {
          path: file.path,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        }
      });
    }

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

    // sendEmail.sendOtpEmail(email, otpArray, existingSeller.firstName);
    await addEmailJob('seller-otp', { email, otpArray, firstName: existingSeller.firstName }, { priority: 1 });

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

    // sendEmail.passwordResetCode(email, otpArray, existingSeller.firstName);
    await addEmailJob('seller-reset-password', { email, otpArray, firstName: existingSeller.firstName }, { priority: 1 });

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

    if (businessType === 'Personal') {
      const { dateOfBirth, residentialAddress, countryIdentificationCardUrl } = req.body;
      const file = req.files ? req.files['countryIdentificationCard'] : null;

      if (!dateOfBirth || !residentialAddress) {
        return res.status(400).json({
          message: 'All fields for Personal Business Account are required'
        });
      }

      let countryIdUrl;

      // Support both presigned URL pattern and direct file upload
      if (countryIdentificationCardUrl) {
        // Presigned URL pattern - validate URL
        if (!validateCloudinaryUrl(countryIdentificationCardUrl)) {
          return res.status(400).json({
            message: 'Invalid Cloudinary URL for country identification card'
          });
        }
        countryIdUrl = countryIdentificationCardUrl;
      } else if (file && file.length > 0) {
        // Legacy file upload - upload to Cloudinary immediately
        try {
          countryIdUrl = await uploadSellerDocument(
            file[0],
            'country_id',
            existingSeller._id.toString()
          );
        } catch (uploadError) {
          return res.status(500).json({
            message: 'File upload failed',
            error: uploadError.message
          });
        }
      } else {
        return res.status(400).json({
          message: 'Country Identification Card is required (either file or URL)'
        });
      }

      // Save with actual Cloudinary URL
      existingSeller.personalBusinessAccount = {
        dateOfBirth,
        residentialAddress,
        countryIdentificationCard: countryIdUrl
      };

      await existingSeller.save();
    } else if (businessType === 'Corporate') {
      const {
        companyName,
        companyAddress,
        vatNumber,
        companyRegNum,
        paymentMethod,
        vatCertificateUrl,
        companyCertificateUrl
      } = req.body;
      const files = req.files;

      if (files) {
        console.log('Received files for business registration:', Object.keys(files).map(key => ({
          field: key,
          originalname: files[key][0].originalname,
          mimetype: files[key][0].mimetype,
          size: files[key][0].size,
          path: files[key][0].path
        })));
      } else {
        console.log('No files received for business registration');
      }

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

      let vatCertUrl, companyCertUrl;

      // Support both presigned URL pattern and direct file upload
      if (vatCertificateUrl && companyCertificateUrl) {
        // Presigned URL pattern - validate URLs
        if (!validateCloudinaryUrl(vatCertificateUrl)) {
          return res.status(400).json({
            message: 'Invalid Cloudinary URL for VAT certificate'
          });
        }
        if (!validateCloudinaryUrl(companyCertificateUrl)) {
          return res.status(400).json({
            message: 'Invalid Cloudinary URL for company certificate'
          });
        }
        vatCertUrl = vatCertificateUrl;
        companyCertUrl = companyCertificateUrl;
      } else if (files && files['vatCertificate'] && files['companyCertificate']) {
        // Legacy file upload - upload to Cloudinary immediately
        try {
          vatCertUrl = await uploadSellerDocument(
            files['vatCertificate'][0],
            'vat_cert',
            existingSeller._id.toString()
          );

          companyCertUrl = await uploadSellerDocument(
            files['companyCertificate'][0],
            'company_cert',
            existingSeller._id.toString()
          );
        } catch (uploadError) {
          return res.status(500).json({
            message: 'Certificate upload failed',
            error: uploadError.message
          });
        }
      } else {
        return res.status(400).json({
          message: 'VAT and Company Certificate are required (either files or URLs)'
        });
      }

      // Save with actual Cloudinary URLs
      existingSeller.corporateBusinessAccount = {
        companyName,
        companyAddress,
        vatNumber,
        vatCertificate: vatCertUrl,
        companyCertificate: companyCertUrl,
        companyRegNum,
        paymentMethod
      };

      await existingSeller.save();
    } else {
      return res.status(400).json({ message: 'Invalid business type' });
    }

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

/**
 * Generate presigned URLs for business document uploads
 */
const getDocumentUploadUrls = async (req, res) => {
  const { businessType, documents } = req.body;
  const sellerId = req.seller._id || req.seller.sellerId;

  if (!businessType || !documents || !Array.isArray(documents)) {
    return res.status(400).json({
      message: 'Business type and documents array are required'
    });
  }

  try {
    const uploadUrls = {};

    // Generate presigned URL for each document
    for (const docType of documents) {
      let documentType;

      // Map frontend document names to backend types
      switch (docType) {
        case 'vatCertificate':
          documentType = 'vat_cert';
          break;
        case 'companyCertificate':
          documentType = 'company_cert';
          break;
        case 'countryIdentificationCard':
          documentType = 'country_id';
          break;
        default:
          continue; // Skip unknown document types
      }

      uploadUrls[docType] = generatePresignedUrl(sellerId, documentType);
    }

    return res.status(200).json({
      status: 200,
      success: true,
      uploadUrls
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Error generating upload URLs',
      error: error.message
    });
  }
};

/**
 * Webhook handler for Cloudinary upload notifications
 */
const cloudinaryWebhook = async (req, res) => {
  try {
    const { public_id, secure_url, notification_type } = req.body;

    // Only process upload_complete notifications
    if (notification_type !== 'upload') {
      return res.status(200).json({ message: 'Notification received' });
    }

    console.log(`Cloudinary upload complete: ${public_id}`);
    console.log(`URL: ${secure_url}`);

    // Extract seller ID and document type from public_id
    // Format: seller_{sellerId}_{documentType}_{timestamp}
    const parts = public_id.split('_');
    if (parts.length >= 3 && parts[0] === 'seller') {
      const sellerId = parts[1];
      const documentType = parts[2];

      console.log(`Seller: ${sellerId}, Document: ${documentType}`);
      // You can add additional processing here if needed
    }

    return res.status(200).json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('Cloudinary webhook error:', error);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
};

/**
 * Verify document upload status (polling fallback)
 */
const verifyDocumentUpload = async (req, res) => {
  const { publicId } = req.params;

  try {
    // Check if resource exists in Cloudinary
    const result = await cloudinary.api.resource(publicId, {
      resource_type: 'auto'
    });

    if (result && result.secure_url) {
      return res.status(200).json({
        status: 200,
        success: true,
        uploaded: true,
        url: result.secure_url,
        publicId: result.public_id
      });
    } else {
      return res.status(200).json({
        status: 200,
        success: true,
        uploaded: false
      });
    }
  } catch (error) {
    // Resource not found or error
    if (error.error && error.error.http_code === 404) {
      return res.status(200).json({
        status: 200,
        success: true,
        uploaded: false
      });
    }

    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Error verifying upload',
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
  userProfile,
  getDocumentUploadUrls,
  cloudinaryWebhook,
  verifyDocumentUpload
};