const bcrypt = require('bcrypt');
const validator = require('validator');
const moment = require('moment');
const Buyer = require('../models/buyerAuthModel');
const OtpCode = require('../../models/otpModel');
const sendEmail = require('../../utils/emailService');
const generateOtpCode = require('../../utils/generateCode');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const axios = require('axios');
const accessControlValidation = require('../middlewares/accessControlValidation');
const Seller = require('../../models/sellerModel');
const Order = require('../../Buyer/models/buyerOrderModel');
const { signJwt, verifyJwt } = require('../../utils/jwt');

const buildBuyerAuthPayload = (buyer) => ({
  id: buyer._id,
  fullName: buyer.fullName,
});

const enableAuthProviderFlags = (buyer, flags = {}) => {
  buyer.authProviders = {
    ...(buyer.authProviders || {}),
    ...flags,
  };
};

const issueBuyerTokens = async (buyer) => {
  const accessToken = signJwt(buildBuyerAuthPayload(buyer), { expiresIn: '3d' });
  const refreshToken = signJwt({ id: buyer._id }, { expiresIn: '7d' });
  buyer.refreshTokenHash = await bcrypt.hash(refreshToken, 12);
  await buyer.save();

  return { accessToken, refreshToken };
};

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
        authProviders: {
          googleLinked: false,
          localPasswordEnabled: true,
        },
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
      console.error('Something went wrong: Service: registerBuyer', error);
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

    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError.message);
      throw new Error('Error in sending OTP email');
    }
  },

  //Retrieve Current User
  getCurrentUser: async (token) => {
    try {
      if (!token) {
        throw new Error(constants.requestValidationMessage.TOKEN_MISSING);
      }
  
      const decoded = verifyJwt(token);
      if (!decoded || !decoded.id) {
        throw new Error(constants.buyerAuthMessage.INVALID_TOKEN);
      }
  
      const buyer = await Buyer.findById(decoded.id);
      if (!buyer) {
        throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
      }

      const orders = await Order.find({ userId: decoded.id });

      let totalUniqueProducts = null;  
  
      if (orders && orders.length > 0) {
        let uniqueProductIds = new Set();
        orders.forEach(order => {
          order.products.forEach(product => {
            uniqueProductIds.add(product.productId.toString());
          });
        });
        if (uniqueProductIds.size > 0) {
          totalUniqueProducts = uniqueProductIds.size;
        }
      }

  
      const lastLogin = buyer.lastLogin;
  
      return {
        user: mongoDbDataFormat.formatMongoData(buyer),
        lastLogin: lastLogin,
        productOrdered: totalUniqueProducts 
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
      enableAuthProviderFlags(buyer, { localPasswordEnabled: true });
  
      const currentLoginTime = mongoDbDataFormat.formatCurrentDate();
      const previousUpdatedLastLogin = buyer.updatedLastLogin || buyer.lastLogin; 
  
      buyer.updatedLastLogin = currentLoginTime;
  
      await buyer.save();
  
      buyer.lastLogin = previousUpdatedLastLogin;
      await buyer.save();
  
      await OtpCode.deleteOne({ email });
  
      const { accessToken, refreshToken } = await issueBuyerTokens(buyer);
  
      return {
        user: mongoDbDataFormat.formatMongoData(buyer),
        accessToken: accessToken,
        refreshToken: refreshToken,
      };
  
    } catch (error) {
      console.error('Something went wrong: Service: confirmOtp', error);
      throw new Error(error.message || 'Error confirming OTP');
    }
  },  

  //Login
  buyerLogin: async ({ email, password }) => {
    try {
      if (!email || !password) {
        throw new Error(constants.requestValidationMessage.BAD_REQUEST);
      }

      if (!validator.isEmail(email)) {
        throw new Error(constants.buyerAuthMessage.INVALID_EMAIL);
      }

      const buyer = await Buyer.findOne({ email });
  
      if (!buyer) {
        throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
      }

      if (!buyer.password) {
        throw new Error(constants.buyerAuthMessage.GOOGLE_PASSWORD_NOT_SET);
      }
  
      const isValid = await bcrypt.compare(password, buyer.password);
      if (!isValid) {
        throw new Error(constants.buyerAuthMessage.INVALID_PASSWORD);
      }

      if (!buyer.authProviders?.localPasswordEnabled) {
        enableAuthProviderFlags(buyer, { localPasswordEnabled: true });
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
  
      const { accessToken, refreshToken } = await issueBuyerTokens(buyer);
  
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
      const decoded = verifyJwt(refreshToken);
      
      const buyer = await Buyer.findById(decoded.id);
      if (!buyer || !buyer.refreshTokenHash) {
        throw new Error(constants.buyerAuthMessage.INVALID_REFRESH_MISSING);
      }
      const isValidRefreshToken = await bcrypt.compare(
        refreshToken,
        buyer.refreshTokenHash
      );

      if (!isValidRefreshToken) {
        throw new Error(constants.buyerAuthMessage.INVALID_REFRESH_MISSING);
      }

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
        await issueBuyerTokens(buyer);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
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
      console.error('Something went wrong: Service: requestResetPassword', error);
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
      enableAuthProviderFlags(buyer, { localPasswordEnabled: true });
      await buyer.save();

      await OtpCode.deleteOne({ email });

      return buyer;
    } catch (error) {
      console.error('Something went wrong: Service: confirmResetPassword', error);
      throw new Error(error.message || 'Error confirming password reset');
    }
  },

  googleLogin: async ({ accessToken }) => {
    try {
      const userInfoRes = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const { sub: googleId, email, name, picture } = userInfoRes.data;

      let buyer = await Buyer.findOne({ email });

      const currentLoginTime = mongoDbDataFormat.formatCurrentDate();

      if (!buyer) {
        buyer = new Buyer({
          email,
          googleId,
          fullName: name,
          profileImage: picture,
          authProviders: {
            googleLinked: true,
            localPasswordEnabled: false,
          },
          isConfirmed: true,
          lastLogin: currentLoginTime,
          updatedLastLogin: currentLoginTime,
        });
        await buyer.save();
      } else {
        // Update user info if they already exist
        let hasChanges = false;
        if (!buyer.googleId) {
          buyer.googleId = googleId;
          hasChanges = true;
        }
        if (!buyer.authProviders?.googleLinked) {
          enableAuthProviderFlags(buyer, { googleLinked: true });
          hasChanges = true;
        }
        if (buyer.password && !buyer.authProviders?.localPasswordEnabled) {
          enableAuthProviderFlags(buyer, { localPasswordEnabled: true });
          hasChanges = true;
        }
        if (picture && buyer.profileImage !== picture) {
          buyer.profileImage = picture;
          hasChanges = true;
        }

        const previousUpdatedLastLogin =
          buyer.updatedLastLogin || buyer.lastLogin || currentLoginTime;
        buyer.updatedLastLogin = currentLoginTime;
        hasChanges = true;

        if (hasChanges) {
          await buyer.save();
        }

        buyer.lastLogin = previousUpdatedLastLogin;
        await buyer.save();
      }

      const { accessToken: accessTokenJWT, refreshToken: refreshTokenJWT } =
        await issueBuyerTokens(buyer);

      return {
        user: mongoDbDataFormat.formatMongoData(buyer),
        accessToken: accessTokenJWT,
        refreshToken: refreshTokenJWT,
      };
    } catch (error) {
      console.error('Something went wrong: Service: googleLogin', error);
      throw new Error(`Google Login Failed: ${error.message}`);
    }
  },

  logout: async (buyerId) => {
    if (!buyerId) {
      return;
    }

    await Buyer.findByIdAndUpdate(buyerId, {
      $unset: {
        refreshTokenHash: 1,
      },
    });
  },
};
