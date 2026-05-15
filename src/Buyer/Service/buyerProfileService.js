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

      const hasLocalPassword = Boolean(findBuyer.password);

      if (hasLocalPassword) {
        if (!oldPassword) {
          throw new Error(constants.buyerProfileMessage.INVALID_OLD_PASSWORD);
        }

        const isMatch = await bcrypt.compare(oldPassword, findBuyer.password);
        if (!isMatch) {
          throw new Error(constants.buyerProfileMessage.INVALID_OLD_PASSWORD);
        }
      } else if (oldPassword) {
        throw new Error(constants.buyerProfileMessage.INVALID_OLD_PASSWORD);
      }

      if (hasLocalPassword) {
        const isSamePassword = await bcrypt.compare(
          newPassword,
          findBuyer.password
        );
        if (isSamePassword) {
          throw new Error(constants.buyerProfileMessage.PASSWORD_SAME_AS_OLD);
        }
      }

      if (!accessControlValidation.isValidPassword(newPassword)) {
        throw new Error(constants.buyerAuthMessage.WEAK_PASSWORD);
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      findBuyer.password = hashedPassword;
      findBuyer.authProviders = {
        ...(findBuyer.authProviders || {}),
        localPasswordEnabled: true,
      };
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

      if (buyer.deliveryAddresses.length >= 5) {
        throw new Error('Maximum of 5 delivery addresses allowed');
      }

      // First address is automatically the default
      if (buyer.deliveryAddresses.length === 0) {
        addressData.isDefault = true;
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

      const wasDefault = buyer.deliveryAddresses.some(
        (a) => String(a._id) === String(addressId) && a.isDefault
      );

      const updatedBuyer = await Buyer.findOneAndUpdate(
        { _id: buyerId },
        { $pull: { deliveryAddresses: { _id: addressId } } },
        { new: true }
      );

      // Promote the first remaining address to default if we deleted the default
      if (wasDefault && updatedBuyer.deliveryAddresses.length > 0) {
        const firstId = updatedBuyer.deliveryAddresses[0]._id;
        await Buyer.updateOne(
          { _id: buyerId, 'deliveryAddresses._id': firstId },
          { $set: { 'deliveryAddresses.$.isDefault': true } }
        );
        updatedBuyer.deliveryAddresses[0].isDefault = true;
      }

      return updatedBuyer.deliveryAddresses;
    } catch (error) {
      console.log('Something went wrong: Service: removeDeliveryAddress', error);
      throw new Error(error.message);
    }
  },

  // Set Default Delivery Address
  setDefaultAddress: async ({ buyerId, addressId }) => {
    try {
      mongoDbDataFormat.checkObjectId(buyerId);
      mongoDbDataFormat.checkObjectId(addressId);

      const buyer = await Buyer.findById(buyerId);
      if (!buyer) {
        throw new Error(constants.buyerProfileMessage.USERPROFILE_NOT_FOUND);
      }

      // Unset all defaults, then mark the target
      await Buyer.updateOne(
        { _id: buyerId },
        { $set: { 'deliveryAddresses.$[].isDefault': false } }
      );

      const updatedBuyer = await Buyer.findOneAndUpdate(
        { _id: buyerId, 'deliveryAddresses._id': addressId },
        { $set: { 'deliveryAddresses.$.isDefault': true } },
        { new: true }
      );

      if (!updatedBuyer) {
        throw new Error('Address not found');
      }

      return updatedBuyer.deliveryAddresses;
    } catch (error) {
      console.log('Something went wrong: Service: setDefaultAddress', error);
      throw new Error(error.message);
    }
  },

  // Update Delivery Address
  updateDeliveryAddress: async ({ buyerId, addressId, addressData }) => {
    try {
      mongoDbDataFormat.checkObjectId(buyerId);
      mongoDbDataFormat.checkObjectId(addressId);

      const buyer = await Buyer.findById(buyerId);
      if (!buyer) {
        throw new Error(constants.buyerProfileMessage.USERPROFILE_NOT_FOUND);
      }

      const updateFields = {};
      for (const key in addressData) {
        updateFields[`deliveryAddresses.$.${key}`] = addressData[key];
      }

      const updatedBuyer = await Buyer.findOneAndUpdate(
        { _id: buyerId, 'deliveryAddresses._id': addressId },
        { $set: updateFields },
        { new: true }
      );

      if (!updatedBuyer) {
        throw new Error('Address not found or update failed');
      }

      return updatedBuyer.deliveryAddresses;
    } catch (error) {
      console.log('Something went wrong: Service: updateDeliveryAddress', error);
      throw new Error(error.message);
    }
  }
};
