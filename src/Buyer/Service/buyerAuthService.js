const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const moment = require('moment');
const Buyer = require('../models/buyerAuthModel');
const OtpCode = require('../../models/otpModel');
const sendEmail = require('../../utils/emailService');
const generateOtpCode = require('../../utils/generateCode');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const accessControlValidation = require('../middlewares/accessControlValidation');
const Seller = require('../../models/sellerModel');

module.exports = {

  //Register 
  registerBuyer: async ({ email, password, fullName, userRoles, gender, phoneNumber }) => {
    try {
      if (!validator.isEmail(email)) {
        throw new Error(constants.buyerAuthMessage.INVALID_EMAIL);
      }

      const buyer = await Buyer.findOne({ email });
      if (buyer) {
        throw new Error(constants.buyerAuthMessage.DUPLICATE_EMAIL);
      }

      const seller = await Seller.findOne({ email });
      if (seller) {
        throw new Error(constants.buyerAuthMessage.EMAIL_NOT_ALLOWED);
      }

      if (!accessControlValidation.isValidPassword(password)) {
        throw new Error(constants.buyerAuthMessage.WEAK_PASSWORD);
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const confirmOtp = generateOtpCode(4);
      const otpArray = confirmOtp.split(''); 
      const expiration = moment().add(10, 'minutes').toDate();

      const newBuyer = new Buyer({
        email,
        password: hashedPassword,
        fullName,
        userRoles,
        gender,
        phoneNumber,
        isConfirmed: false
      });

      await sendEmail.sendOtpEmail(email, otpArray, fullName);

      const result = await newBuyer.save();

      await OtpCode.updateOne(
        { email },
        { $set: { code: confirmOtp, expiration: expiration } },
        { upsert: true }
      );

      return mongoDbDataFormat.formatMongoData(result);

    } catch (error) {
      console.log('Something went wrong: Service: registerBuyer', error);
      throw new Error(`Service Error: ${error.message}`);
    }
  },

  ///Resend Otp
  resendOtp: async (email) => {
    try {
      const buyer = await Buyer.findOne({ email });
      if (!buyer) {
        throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
      }

      const otp = generateOtpCode(4);
      const otpArray = otp.split(''); 
      const expiration = moment().add(10, 'minutes').toDate();
      await sendEmail.sendOtpEmail(email, otpArray, buyer.fullName);

      await OtpCode.updateOne(
        { email },
        { $set: { code: otp, expiration: expiration } },
        { upsert: true }
      );

    } catch (error) {
      console.error('Something went wrong: Service: resendOtp', error);
      throw new Error(error.message || 'Error in resending OTP');
    }
  },

  //Retrieve Current User
  getCurrentUser: async (token) => {
    try {
      if (!token) {
        throw new Error(constants.requestValidationMessage.TOKEN_MISSING);
      }
  
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
      if (!decoded || !decoded.id) {
        throw new Error(constants.buyerAuthMessage.INVALID_TOKEN);
      }
  
      const buyer = await Buyer.findById(decoded.id);
      if (!buyer) {
        throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
      }
  
      const lastLogin = buyer.lastLogin;
  
      return {
        user: mongoDbDataFormat.formatMongoData(buyer),
        lastLogin: lastLogin 
      };
  
    } catch (error) {
      console.error('Something went wrong: Service: getCurrentUser', error);
      throw new Error(error.message || 'Error retrieving user information');
    }
  },
  


  confirmOtp: async (email, otp) => {
    try {
      if (!email || !otp) {
        throw new Error(constants.buyerAuthMessage.FIELD_REQUIRED);
      }
  
      const buyer = await Buyer.findOne({ email });
      if (!buyer) {
        throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
      }
  
      if (buyer.isConfirmed) {
        throw new Error(constants.buyerAuthMessage.EMAIL_ALREADY_CONFIRMED);
      }
  
      const validOtp = await OtpCode.findOne({ email });
      if (!validOtp) {
        throw new Error(constants.buyerAuthMessage.INVALID_TOKEN);
      }
  
      if (validOtp.code !== otp) {
        throw new Error(constants.buyerAuthMessage.INVALID_TOKEN);
      }
  
      if (validOtp.expiration < new Date()) {
        throw new Error(constants.buyerAuthMessage.TOKEN_EXPIRED);
      }
  
      buyer.isConfirmed = true;
  
      const currentLoginTime = mongoDbDataFormat.formatCurrentDate();
      const previousUpdatedLastLogin = buyer.updatedLastLogin || buyer.lastLogin; 
  
      buyer.updatedLastLogin = currentLoginTime;
  
      await buyer.save();
  
      buyer.lastLogin = previousUpdatedLastLogin;
      await buyer.save();
  
      await OtpCode.deleteOne({ email });
  
      const tokenPayload = {
        id: buyer._id,
        fullName: buyer.fullName,
      };
  
      const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'my-secret-key', { expiresIn: '3d' });
      const refreshToken = jwt.sign({ id: buyer._id }, process.env.JWT_SECRET || 'my-secret-key', { expiresIn: '7d' });
  
      return {
        user: mongoDbDataFormat.formatMongoData(buyer),
        accessToken: accessToken,
        refreshToken: refreshToken,
      };
  
    } catch (error) {
      console.log('Something went wrong: Service: confirmOtp', error);
      throw new Error(error.message || 'Error confirming OTP');
    }
  },  

  //Login
  buyerLogin: async ({ email, password }) => {
    try {
      const buyer = await Buyer.findOne({ email });
  
      if (!validator.isEmail(email)) {
        throw new Error(constants.buyerAuthMessage.INVALID_EMAIL);
      }
  
      if (!buyer) {
        throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
      }
  
      const isValid = await bcrypt.compare(password, buyer.password);
      if (!isValid) {
        throw new Error(constants.buyerAuthMessage.INVALID_PASSWORD);
      }
  
      if (!buyer.isConfirmed) {
        await module.exports.resendOtp(email); 
        throw new Error(constants.buyerAuthMessage.EMAIL_NOT_CONFIRMED);
      }
  
      const currentLoginTime =  mongoDbDataFormat.formatCurrentDate();
  
      if (!buyer.lastLogin) {
        buyer.lastLogin = currentLoginTime;
      }
  
      const previousUpdatedLastLogin = buyer.updatedLastLogin || buyer.lastLogin; 
      buyer.updatedLastLogin = currentLoginTime;
  
      const tokenPayload = {
        id: buyer._id,
        fullName: buyer.fullName,
      };
  
      const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'my-secret-key', { expiresIn: '3d' });
      const refreshToken = jwt.sign({ id: buyer._id }, process.env.JWT_SECRET || 'my-secret-key', { expiresIn: '7d' });
  
      buyer.refreshToken = refreshToken;
      await buyer.save();
  
      const result = {
        user: mongoDbDataFormat.formatMongoData(buyer),
        accessToken: accessToken,
        refreshToken: refreshToken,
        // lastLogin: buyer.lastLogin,           
        // currentLogin: currentLoginTime        
      };
  
      buyer.lastLogin = previousUpdatedLastLogin;
      await buyer.save();
  
      return result;
  
    } catch (error) {
      console.error('Something went wrong: Service: buyerLogin', error);
      throw new Error(error.message || 'Error during login');
    }
  },
  


  //Refresh Token
  refreshToken: async (refreshToken) => {
    if (!refreshToken) {
      throw new Error(constants.buyerAuthMessage.REFRESH_TOKEN_MISSING);
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'my-secret-key');
      
      const buyer = await Buyer.findById(decoded.id);
      if (!buyer || buyer.refreshToken !== refreshToken) {
        throw new Error(constants.buyerAuthMessage.INVALID_REFRESH_MISSING);
      }
      const tokenPayload = {
        id: buyer._id,
        fullName: buyer.fullName,
      };
      const newAccessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'my-secret-key', { expiresIn: '3d' });
      return {
        accessToken: newAccessToken,
      };

    } catch (error) {
      console.error('Something went wrong: Service: refreshToken', error); 
      throw new Error(error.message || 'Error refreshing token');
    }
  },


  //Reset Password
  requestResetPassword: async (email) => {
    try {
      const buyer = await Buyer.findOne({ email });
      if (!buyer) {
        throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
      }
      const otp = generateOtpCode(4);
      
      const otpArray = otp.split(''); 

      const expiration = moment().add(10, 'minutes').toDate();

      await sendEmail.passwordResetCode(email, otpArray, buyer.fullName);

      await OtpCode.updateOne(
        { email },
        { $set: { code: otp, expiration: expiration } },
        { upsert: true }
      );

    } catch (error) {
      console.log('Something went wrong: Service: requestResetPassword', error);
      throw new Error(error.message || 'Error requesting password reset');
    }
  },


  //Confirm reset Password
  confirmResetPassword: async (email, otp, newPassword, confirmPassword) => {
    try {
      if (!email || !otp || !newPassword || !confirmPassword) {
        throw new Error(constants.buyerAuthMessage.FIELD_REQUIRED);
      }
      const buyer = await Buyer.findOne({ email });
      if (!buyer) {
        throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
      }

      const validOtp = await OtpCode.findOne({ email });
      if (!validOtp) {
        throw new Error(constants.buyerAuthMessage.INVALID_TOKEN);
      }

      if (validOtp.code !== otp) {
        throw new Error(constants.buyerAuthMessage.INVALID_TOKEN);
      }

      if (validOtp.expiration < new Date()) {
        throw new Error(constants.buyerAuthMessage.TOKEN_EXPIRED);
      }

      if (!accessControlValidation.isValidPassword(newPassword)) {
        throw new Error(constants.buyerAuthMessage.WEAK_PASSWORD);
      }

      if (newPassword !== confirmPassword) {
        throw new Error(constants.buyerAuthMessage.MATCH_PASSWORD);
      }
      
      buyer.password = await bcrypt.hash(newPassword, 12);
      await buyer.save();

      await OtpCode.deleteOne({ email });

      return buyer;
    } catch (error) {
      console.log('Something went wrong: Service: confirmResetPassword', error);
      throw new Error(error.message || 'Error confirming password reset');
    }
  },
};
