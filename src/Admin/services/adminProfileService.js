const Admin = require('../Model/adminAuthModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const bcrypt = require('bcryptjs');
const ftp = require('basic-ftp');
const accessControlValidation = require('../middleware/accessControlValidation');
const { Readable } = require('stream');

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
      console.log('Something went wrong: Service: updateAdminProfile', error);
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
      console.log('Something went wrong: Service: changeAdminPassword', error);
      throw new Error(error.message);
    }
  },


  uploadAdminProfileImage: async ({ adminId, fileBuffer, originalName }) => {
    const client = new ftp.Client();
    client.ftp.verbose = true;

    const uniqueFileName = `${Date.now()}-${originalName}`;
    const remoteFilePath = `/public_html/Buyer_Profile_images/${uniqueFileName}`;

    try {
      await client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        port: process.env.FTP_PORT || 21,
        secure: false
      });

      const stream = new Readable();
      stream.push(fileBuffer);
      stream.push(null);

      await client.uploadFrom(stream, remoteFilePath);

      const imageUrl = `https://${process.env.FTP_HOST}/Buyer_Profile_images/${uniqueFileName}`;

      const updatedProfile = await Admin.findOneAndUpdate(
        { _id: adminId },
        { profileImage: imageUrl },
        { new: true }
      );

      if (!updatedProfile) {
        throw new Error(constants.adminProfileMessage.USERPROFILE_NOT_FOUND);
      }

      return mongoDbDataFormat.formatMongoData(updatedProfile);
    } catch (error) {
      console.error('Service error: uploadAdminProfileImage', error);
      throw new Error(error.message);
    } finally {
      client.close();
    }
  }
};
