const Buyer = require('../models/buyerAuthModel');
const constants = require('../constants');
const mongoDbDataFormat = require('../helper/dbHelper');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const validator = require("validator");
const accessControlValidation = require('../middlewares/accessControlValidation');
const OtpCode = require('../../models/otpModel');
const sendEmail = require('../../utils/emailService');
const generateOtpCode = require('../../utils/generateCode');
const moment = require('moment'); 

module.exports.registerBuyer = async ({ email, password, fullName, userRoles, gender, phoneNumber }) => {
  try {
    if (!validator.isEmail(email)) {
      throw new Error(constants.buyerAuthMessage.INVALID_EMAIL);
    }

    const buyer = await Buyer.findOne({ email });
    if (buyer) {
      throw new Error(constants.buyerAuthMessage.DUPLICATE_EMAIL);
    }

    if (!accessControlValidation.isValidPassword(password)) {
      throw new Error(constants.buyerAuthMessage.WEAK_PASSWORD);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const confirmOtp = generateOtpCode(6);
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

    
    sendEmail.sendOtpEmail(email, confirmOtp)

    .then(() => {
        console.log('OTP email sent successfully');
    })
    .catch((error) => {
        console.error('Error sending OTP email:', error);
    });

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
};

module.exports.resendOtp = async (email) => {
  try {
    const buyer = await Buyer.findOne({ email });
    if (!buyer) {
      throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
    }

    const otp = generateOtpCode(6);
    const expiration = moment().add(10, 'minutes').toDate();
    sendEmail.sendOtpEmail(email, otp)
    .then(() => {
        console.log('OTP email sent successfully');
    })
    .catch((error) => {
        console.error('Error sending OTP email:', error);
    });

    await OtpCode.updateOne(
      { email },  
      { $set: { code: otp, expiration: expiration } },  
      { upsert: true }  
    );

    return otp;
  } catch (error) {
    console.error('Something went wrong: Service:resendOtp', error);
    throw new Error(error.message || 'Error in resending OTP');
  }
};





module.exports.confirmOtp = async (email, otp) => {
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

    if (validOtp.code !== otp) {
      throw new Error(constants.buyerAuthMessage.INVALID_TOKEN);
    }

    if (validOtp.expiration < new Date()) {
      throw new Error(constants.buyerAuthMessage.TOKEN_EXPIRED);
    }
    buyer.isConfirmed = true;
    await buyer.save();

    await OtpCode.deleteOne({ email });

    return mongoDbDataFormat.formatMongoData(buyer);
  } catch (error) {
    console.log('Something went wrong: Service: confirmOtp', error);
    throw new Error(error.message);
  }
};



module.exports.buyerLogin = async ({ email, password }) => {
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
      throw new Error(constants.buyerAuthMessage.EMAIL_NOT_CONFIRMED);
    }


    const lastLogin = mongoDbDataFormat.formatCurrentDate();

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
      lastLogin: lastLogin  
    };

    return result;

  } catch (error) {
    console.error('Something went wrong: Service: login', error);
    throw new Error(error);
  }
};






module.exports.refreshToken = async (refreshToken) => {
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

  }  catch (error) {
    console.error('Something went wrong: Service: RefreshToken', error); 
    throw new Error(error);
  }
};



module.exports.requestResetPassword = async (email) => {
    try {
      const buyer = await Buyer.findOne({ email });
      if (!buyer) {
        throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
      }
      const otp = generateOtpCode(6);
      const expiration = moment().add(10, 'minutes').toDate();
      sendEmail.passwordResetCode(email, otp)
      .then(() => {
          console.log('OTP email sent successfully');
      })
      .catch((error) => {
          console.error('Error sending OTP email:', error);
      });
      await OtpCode.updateOne(
        { email },  
        { $set: { code: otp, expiration: expiration } },  
        { upsert: true }  
      );

      return otp;
    } catch (error) {
      console.log('Something went wrong: Service:requestResetPassword', error);
    throw new Error(error);
    }
  };
  
  
  module.exports.confirmResetPassword = async (email, otp, newPassword, confirmPassword) => {
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
        throw new Error(error.message);
    }
};