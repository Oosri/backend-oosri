const Admin = require('../Model/adminAuthModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const bcrypt = require('bcryptjs');
const accessControlValidation = require('../middleware/accessControlValidation');
const { Readable } = require('stream');
const { uploadFromStream } = require('../../utils/cloudinary');


module.exports = {
  updateAdminProfile: async ({ adminId, updateData }) => {
    try {
      mongoDbDataFormat.checkObjectId(adminId);

      const updatedProfile = await Admin.findOneAndUpdate(
        { _id: adminId },
        updateData,
        { new: true }
      );

      if (!updatedProfile) {
        throw new Error(constants.adminProfileMessage.USERPROFILE_NOT_FOUND);
      }

      return mongoDbDataFormat.formatMongoData(updatedProfile);
    } catch (error) {
      console.error('Something went wrong: Service: updateAdminProfile', error);
      throw new Error(error.message);
    }
  },
  changeAdminPassword: async ({ adminId, oldPassword, newPassword }) => {
    try {
      mongoDbDataFormat.checkObjectId(adminId);

      const findAdmin = await Admin.findOne({ _id: adminId });
      if (!findAdmin) {
        throw new Error(constants.adminProfileMessage.USERPROFILE_NOT_FOUND);
      }

      const isMatch = await bcrypt.compare(oldPassword, findAdmin.password);
      if (!isMatch) {
        throw new Error(constants.adminProfileMessage.INVALID_OLD_PASSWORD);
      }

      const isSamePassword = await bcrypt.compare(
        newPassword,
        findAdmin.password
      );
      if (isSamePassword) {
        throw new Error(constants.adminProfileMessage.PASSWORD_SAME_AS_OLD);
      }

      if (!accessControlValidation.isValidPassword(newPassword)) {
        throw new Error(constants.adminAuthMessage.WEAK_PASSWORD);
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      findAdmin.password = hashedPassword;
      await findAdmin.save();

      return;
    } catch (error) {
      console.error('Something went wrong: Service: changeAdminPassword', error);
      throw new Error(error.message);
    }
  },
  uploadAdminProfileImage: async ({ adminId, fileBuffer, originalName }) => {
    try {
      const timestamp = Date.now();
      const sanitizedName = originalName
        .split('.')[0]
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50);

      const publicId = `admin_${adminId}_${timestamp}_${sanitizedName}`;

      const result = await uploadFromStream(fileBuffer, {
        folder: 'admin/profile_images',
        resourceType: 'image',
        publicId,
        transformation: [
          { width: 500, height: 500, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ],
        allowedFormats: ['jpg', 'jpeg', 'png', 'gif']
      });

      // Update admin profile with Cloudinary URL
      const updatedProfile = await Admin.findOneAndUpdate(
        { _id: adminId },
        { profileImage: result.secure_url },
        { new: true }
      );

      if (!updatedProfile) {
        throw new Error(constants.adminProfileMessage.USERPROFILE_NOT_FOUND);
      }

      return mongoDbDataFormat.formatMongoData(updatedProfile);
    } catch (error) {
      console.error('Service error: uploadAdminProfileImage', error);
      throw new Error(error.message);
    }
  }
};
