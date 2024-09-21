const Buyer = require('../models/buyerAuthModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const bcrypt = require('bcryptjs'); 
const ftp = require('basic-ftp');
const accessControlValidation = require('../middlewares/accessControlValidation');

module.exports = {

  //Update Buyer  
  updateBuyerProfile : async ({ buyerId, updateData }) => {
    try {
      mongoDbDataFormat.checkObjectId(buyerId);
  
      const updatedProfile = await Buyer.findOneAndUpdate(
        { _id: buyerId }, 
        updateData,
        { new: true } 
      );
  
      if (!updatedProfile) {
        throw new Error(constants.buyerProfileMessage.USERPROFILE_NOT_FOUND);
      }
      
      return mongoDbDataFormat.formatMongoData(updatedProfile);
    } catch (error) {
      console.log('Something went wrong: Service: updateBuyerProfile', error);
      throw new Error(error.message);
    }
  },

  //Change Password
  changeBuyerPassword : async ({ buyerId, oldPassword, newPassword }) => {
    try {
      mongoDbDataFormat.checkObjectId(buyerId);
  
      const findBuyer = await Buyer.findOne({ _id: buyerId });
      if (!findBuyer) {
        throw new Error(constants.buyerProfileMessage.USERPROFILE_NOT_FOUND);
      }
  
      const isMatch = await bcrypt.compare(oldPassword, findBuyer.password);
      if (!isMatch) {
        throw new Error(constants.buyerProfileMessage.INVALID_OLD_PASSWORD);
      }

      const isSamePassword = await bcrypt.compare(newPassword, findBuyer.password);
    if (isSamePassword) {
      throw new Error(constants.buyerProfileMessage.PASSWORD_SAME_AS_OLD);
    }

      if (!accessControlValidation.isValidPassword(newPassword)) {
        throw new Error(constants.buyerAuthMessage.WEAK_PASSWORD);
      }
  
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      findBuyer.password = hashedPassword;
      await findBuyer.save();
  
      return ;
    } catch (error) {
      console.log('Something went wrong: Service: changeBuyerPassword', error);
      throw new Error(error.message);
    }
  },

  
  //Profile Image

  uploadBuyerProfileImage: async ({ buyerId, localFilePath, originalName }) => {
    const client = new ftp.Client(); 
    client.ftp.verbose = true;
  
    const uniqueFileName = `${Date.now()}-${originalName}`; 
    const remoteFilePath = `/public_html/Buyer_Profile_images/${uniqueFileName}`;
  
    try {
      mongoDbDataFormat.checkObjectId(buyerId);
  
      await client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: false,
        port: process.env.FTP_PORT || 21,
      });
  
      await client.uploadFrom(localFilePath, remoteFilePath);
  
      const imageUrl = `https://${process.env.FTP_HOST}/Buyer_Profile_images/${uniqueFileName}`;

  
      const updatedProfile = await Buyer.findOneAndUpdate(
        { _id: buyerId },
        { profileImage: imageUrl },
        { new: true }
      );
  
      if (!updatedProfile) {
        throw new Error(constants.buyerProfileMessage.USERPROFILE_NOT_FOUND);
      }
  
      return mongoDbDataFormat.formatMongoData(updatedProfile);
  
    } catch (error) {
      console.error('Service error: uploadBuyerProfileImage', error);
      throw new Error(error.message);
    } finally {
      client.close();  
    }
  }
};  