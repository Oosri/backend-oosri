const Buyer = require('../models/buyerAuthModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const bcrypt = require('bcryptjs');
const accessControlValidation = require('../middlewares/accessControlValidation');
const { Readable } = require('stream');

module.exports = {
  //Update Buyer
  updateBuyerProfile: async ({ buyerId, updateData }) => {
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
  changeBuyerPassword: async ({ buyerId, oldPassword, newPassword }) => {
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

      const isSamePassword = await bcrypt.compare(
        newPassword,
        findBuyer.password
      );
      if (isSamePassword) {
        throw new Error(constants.buyerProfileMessage.PASSWORD_SAME_AS_OLD);
      }

      if (!accessControlValidation.isValidPassword(newPassword)) {
        throw new Error(constants.buyerAuthMessage.WEAK_PASSWORD);
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      findBuyer.password = hashedPassword;
      await findBuyer.save();

      return;
    } catch (error) {
      console.log('Something went wrong: Service: changeBuyerPassword', error);
      throw new Error(error.message);
    }
  },

  //Profile Image
  uploadBuyerProfileImage: async ({ buyerId, fileBuffer, originalName }) => {
    try {
      const timestamp = Date.now();
      const sanitizedName = originalName
        .split('.')[0]
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50);

      const publicId = `buyer_${buyerId}_${timestamp}_${sanitizedName}`;

      const result = await uploadFromStream(fileBuffer, {
        folder: 'buyer/profile_images',
        resourceType: 'image',
        publicId,
        transformation: [
          { width: 500, height: 500, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ],
        allowedFormats: ['jpg', 'jpeg', 'png', 'gif']
      });

      // Update buyer profile with Cloudinary URL
      const updatedProfile = await Buyer.findOneAndUpdate(
        { _id: buyerId },
        { profileImage: result.secure_url },
        { new: true }
      );

      if (!updatedProfile) {
        throw new Error(constants.buyerProfileMessage.USERPROFILE_NOT_FOUND);
      }

      return mongoDbDataFormat.formatMongoData(updatedProfile);
    } catch (error) {
      console.error('Service error: uploadBuyerProfileImage', error);
      throw new Error(error.message);
    }
  },

  // Get Delivery Addresses
  getDeliveryAddresses: async ({ buyerId }) => {
    try {
      mongoDbDataFormat.checkObjectId(buyerId);
      const buyer = await Buyer.findById(buyerId);
      if (!buyer) {
        throw new Error(constants.buyerProfileMessage.USERPROFILE_NOT_FOUND);
      }
      return buyer.deliveryAddresses;
    } catch (error) {
      console.log('Something went wrong: Service: getDeliveryAddresses', error);
      throw new Error(error.message);
    }
  },

  // Add Delivery Address
  addDeliveryAddress: async ({ buyerId, addressData }) => {
    try {
      mongoDbDataFormat.checkObjectId(buyerId);

      const buyer = await Buyer.findById(buyerId);
      if (!buyer) {
        throw new Error(constants.buyerProfileMessage.USERPROFILE_NOT_FOUND);
      }

      if (buyer.deliveryAddresses.length >= 3) {
        throw new Error('Maximum of 3 delivery addresses allowed');
      }

      const updatedBuyer = await Buyer.findOneAndUpdate(
        { _id: buyerId },
        { $push: { deliveryAddresses: addressData } },
        { new: true }
      );

      return updatedBuyer.deliveryAddresses;
    } catch (error) {
      console.log('Something went wrong: Service: addDeliveryAddress', error);
      throw new Error(error.message);
    }
  },

  // Remove Delivery Address
  removeDeliveryAddress: async ({ buyerId, addressId }) => {
    try {
      mongoDbDataFormat.checkObjectId(buyerId);

      const buyer = await Buyer.findById(buyerId);
      if (!buyer) {
        throw new Error(constants.buyerProfileMessage.USERPROFILE_NOT_FOUND);
      }

      const updatedBuyer = await Buyer.findOneAndUpdate(
        { _id: buyerId },
        { $pull: { deliveryAddresses: { _id: addressId } } },
        { new: true }
      );

      return updatedBuyer.deliveryAddresses;
    } catch (error) {
      console.log('Something went wrong: Service: removeDeliveryAddress', error);
      throw new Error(error.message);
    }
  }
};
