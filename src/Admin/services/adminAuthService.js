const bcrypt = require('bcrypt');
const validator = require('validator');
const moment = require('moment');
const Admin = require('../Model/adminAuthModel');
const OtpCode = require('../../models/otpModel');
const sendEmail = require('../../utils/emailService');
const generateOtpCode = require('../../utils/generateCode');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const accessControlValidation = require('../middleware/accessControlValidation');
const Seller = require('../../models/sellerModel');
const { signJwt, verifyJwt } = require('../../utils/jwt');

module.exports = {


  createAdmin: async ({ email, fullName, userRoles = 'admin', permissions = [], phoneNumber }) => {
    try {
      if (!validator.isEmail(email)) {
        throw new Error(constants.adminAuthMessage.INVALID_EMAIL);
      }
  
      const admin = await Admin.findOne({ email });
      if (admin) {
        throw new Error(constants.adminAuthMessage.DUPLICATE_EMAIL);
      }
  
      const seller = await Seller.findOne({ email });
      if (seller) {
        throw new Error(constants.adminAuthMessage.EMAIL_NOT_ALLOWED);
      }
  
      const generatedPassword = accessControlValidation.generateStrongPassword(10);
      if (!accessControlValidation.isValidPassword(generatedPassword)) {
        throw new Error(constants.adminAuthMessage.WEAK_PASSWORD);
      }
  
      const hashedPassword = await bcrypt.hash(generatedPassword, 12);
  
      const newAdmin = new Admin({
        email,
        password: hashedPassword,
        fullName,
        userRoles,
        permissions,
        phoneNumber,
        isConfirmed: true
      });
  
      await sendEmail.sendOnBoardingEmail(email, generatedPassword, fullName);
  
      const result = await newAdmin.save();
  
      return mongoDbDataFormat.formatMongoData(result);
  
    } catch (error) {
      console.error('Something went wrong: Service: createAdmin', error);
      throw new Error(`Service Error: ${error.message}`);
    }
  },  

  ///Resend Otp
  resendOtp: async (email) => {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      throw new Error(constants.adminAuthMessage.USER_NOT_FOUND);
    }

    const otp = generateOtpCode(4);
    const otpArray = otp.split('');
    const expiration = moment().add(10, 'minutes').toDate();

    await OtpCode.updateOne(
      { email },
      { $set: { code: otp, expiration: expiration } },
      { upsert: true }
    );

    try {
      await sendEmail.sendOtpEmail(email, otpArray, admin.fullName);
    } catch (emailError) {
      console.error('Resend OTP email failed (continuing anyway):', emailError.message);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n🔑  DEV resend OTP for ${email}: ${otp}\n`);
    }
  },

  getCurrentUser: async (token) => {
    try {
      if (!token) {
        throw new Error(constants.requestValidationMessage.TOKEN_MISSING);
      }
  
      const decoded = verifyJwt(token);
      if (!decoded || !decoded.id) {
        throw new Error(constants.adminAuthMessage.INVALID_TOKEN);
      }
  
      const admin = await Admin.findById(decoded.id);
      if (!admin) {
        throw new Error(constants.adminAuthMessage.USER_NOT_FOUND);
      }
      const lastLogin = admin.lastLogin;
      return {
        user: mongoDbDataFormat.formatMongoData(admin),
        lastLogin: lastLogin,
      };
    } catch (error) {
      console.error('Something went wrong: Service: getCurrentUser', error);
      throw new Error(error.message || 'Error retrieving user information');
    }
  },


  adminLogin: async ({ email, password }) => {
    try {
      const admin = await Admin.findOne({ email });
  
      if (!validator.isEmail(email)) {
        throw new Error(constants.adminAuthMessage.INVALID_EMAIL);
      }
  
      if (!admin) {
        throw new Error(constants.adminAuthMessage.USER_NOT_FOUND);
      }
  
      const isValid = await bcrypt.compare(password, admin.password);
      if (!isValid) {
        throw new Error(constants.adminAuthMessage.INVALID_PASSWORD);
      }

      const otp = generateOtpCode(4);
      const otpArray = otp.split('');
      const expiration = moment().add(10, 'minutes').toDate();

      await OtpCode.updateOne(
        { email },
        { $set: { code: otp, expiration: expiration } },
        { upsert: true }
      );

      try {
        await sendEmail.loginOtpEmail(email, otpArray, admin.fullName);
      } catch (emailError) {
        console.error('OTP email failed (continuing anyway):', emailError.message);
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`\n🔑  DEV OTP for ${email}: ${otp}\n`);
      }

      return { success: true };
  
    } catch (error) {
      console.error('Something went wrong: Service: adminLogin', error);
      throw new Error(error.message || 'Error during login');
    }
  },
  

  verifyLogin2FA: async (email, otp) => {
    try {
      if (!email || !otp) {
        throw new Error(constants.adminAuthMessage.FIELD_REQUIRED);
      }

      const admin = await Admin.findOne({ email });
      if (!admin) {
        throw new Error(constants.adminAuthMessage.USER_NOT_FOUND);
      }

      const validOtp = await OtpCode.findOne({ email });

      if (!validOtp) {
        throw new Error(constants.adminAuthMessage.INVALID_TOKEN);
      }

      if (validOtp.code !== otp.trim()) {
        throw new Error(constants.adminAuthMessage.INVALID_TOKEN);
      }

      if (validOtp.expiration < new Date()) {
        throw new Error(constants.adminAuthMessage.TOKEN_EXPIRED);
      }

      const currentLoginTime = mongoDbDataFormat.formatCurrentDate();
      const previousUpdatedLastLogin = admin.updatedLastLogin || admin.lastLogin;

      admin.updatedLastLogin = currentLoginTime;
      await admin.save();

      admin.lastLogin = previousUpdatedLastLogin;
      await admin.save();

      await OtpCode.deleteOne({ email });

      const tokenPayload = { id: admin._id, fullName: admin.fullName };
      const accessToken  = signJwt(tokenPayload, { expiresIn: '15m' });
      const refreshToken = signJwt({ id: admin._id }, { expiresIn: '7d' });

      return {
        user: mongoDbDataFormat.formatMongoData(admin),
        accessToken,
        refreshToken,
      };

    } catch (error) {
      console.error('Something went wrong: Service: verifyLogin2fa', error);
      throw new Error(error.message || 'Error confirming OTP');
    }
  },


  refreshToken: async (refreshToken) => {
    if (!refreshToken) {
      throw new Error(constants.adminAuthMessage.REFRESH_TOKEN_MISSING);
    }

    try {
      const decoded = verifyJwt(refreshToken);
      
      const admin = await Admin.findById(decoded.id);
      if (!admin || admin.refreshToken !== refreshToken) {
        throw new Error(constants.adminAuthMessage.INVALID_REFRESH_MISSING);
      }
      const tokenPayload = {
        id: admin._id,
        fullName: admin.fullName,
      };
      const newAccessToken = signJwt(tokenPayload, { expiresIn: '15m' });
      return {
        accessToken: newAccessToken,
      };

    } catch (error) {
      console.error('Something went wrong: Service: refreshToken', error); 
      throw new Error(error.message || 'Error refreshing token');
    }
  },


  requestResetPassword: async (email) => {
    try {
      const admin = await Admin.findOne({ email });
      if (!admin) {
        throw new Error(constants.adminAuthMessage.USER_NOT_FOUND);
      }
      const otp = generateOtpCode(4);
      const otpArray = otp.split('');
      const expiration = moment().add(10, 'minutes').toDate();

      await OtpCode.updateOne(
        { email },
        { $set: { code: otp, expiration: expiration } },
        { upsert: true }
      );

      try {
        await sendEmail.passwordResetCode(email, otpArray, admin.fullName);
      } catch (emailError) {
        console.error('Password reset email failed (continuing anyway):', emailError.message);
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`\n🔑  DEV reset OTP for ${email}: ${otp}\n`);
      }

    } catch (error) {
      console.error('Something went wrong: Service: requestResetPassword', error);
      throw new Error(error.message || 'Error requesting password reset');
    }
  },



  validateResetPasswordToken: async (email, otp) => {
    try {
      const validOtp = await OtpCode.findOne({ email });
      if (!validOtp || validOtp.code !== otp) {
        throw new Error(constants.adminAuthMessage.INVALID_TOKEN);
      }
  
      if (validOtp.expiration < new Date()) {
        throw new Error(constants.adminAuthMessage.TOKEN_EXPIRED);
      }
  
      return { success: true };
  
    } catch (error) {
      console.error('Something went wrong: Service: validateResetPasswordToken', error);
      throw new Error(error.message || 'Error validating reset token');
    }
  },

  confirmResetPassword: async (email, otp, newPassword, confirmPassword) => {
    try {
      if (!email || !otp || !newPassword || !confirmPassword) {
        throw new Error(constants.adminAuthMessage.FIELD_REQUIRED);
      }
      const admin = await Admin.findOne({ email });
      if (!admin) {
        throw new Error(constants.adminAuthMessage.USER_NOT_FOUND);
      }

      const validOtp = await OtpCode.findOne({ email });
      if (!validOtp) {
        throw new Error(constants.adminAuthMessage.INVALID_TOKEN);
      }

      if (validOtp.code !== otp) {
        throw new Error(constants.adminAuthMessage.INVALID_TOKEN);
      }

      if (validOtp.expiration < new Date()) {
        throw new Error(constants.adminAuthMessage.TOKEN_EXPIRED);
      }

      if (!accessControlValidation.isValidPassword(newPassword)) {
        throw new Error(constants.adminAuthMessage.WEAK_PASSWORD);
      }

      if (newPassword !== confirmPassword) {
        throw new Error(constants.adminAuthMessage.MATCH_PASSWORD);
      }
      
      admin.password = await bcrypt.hash(newPassword, 12);
      admin.refreshToken = null;
      await admin.save();

      await OtpCode.deleteOne({ email });

      return admin;
    } catch (error) {
      console.error('Something went wrong: Service: confirmResetPassword', error);
      throw new Error(error.message || 'Error confirming password reset');
    }
  },
};
