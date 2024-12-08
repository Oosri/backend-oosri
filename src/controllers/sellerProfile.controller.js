const Seller = require('../models/sellerModel');
const ftpClient = require('basic-ftp');
const { Readable } = require('stream');
const bcrypt = require('bcryptjs');

const sellerAccountUpdate = async (req, res) => {
  const sellerId = req.params.sellerId;
  const sellerData = req.body;
  const files = req.files;

  const client = new ftpClient.Client();
  client.ftp.verbose = true;

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: false,
      port: process.env.FTP_PORT || 21
    });

    let fileUploads = {};

    if (files['countryIdentificationCard']) {
      const countryIdFile = files['countryIdentificationCard'][0];
      const countryIdFileName = `${Date.now()}-${countryIdFile.originalname}`;
      const countryRemoteFilePath = `/public_html/seller_docs/${countryIdFileName}`;

      const stream = new Readable();
      stream.push(files['countryIdentificationCard'][0].buffer);
      stream.push(null);

      await client.uploadFrom(stream, countryRemoteFilePath);
      fileUploads[
        'personalBusinessAccount.countryIdentificationCard'
      ] = `https://${process.env.FTP_HOST}/seller_docs${countryIdFileName}`;
    }

    if (req.files['vatCertificate']) {
      const vatFile = req.files['vatCertificate'][0];
      const vatFileName = `${Date.now()}-${vatFile.originalname}`;
      const vatFilePath = `/public_html/seller_docs/${vatFileName}`;

      const stream = new Readable();
      stream.push(files['vatCertificate'][0].buffer);
      stream.push(null);

      await client.uploadFrom(stream, vatFilePath);
      fileUploads[
        'corporateBusinessAccount.vatCertificate'
      ] = `https://${process.env.FTP_HOST}/seller_docs${vatFilePath}`;
    }

    if (req.files['companyCertificate']) {
      const companyCertFile = req.files['companyCertificate'][0];
      const companyCertFileName = `${Date.now()}-${
        companyCertFile.originalname
      }`;
      const companyCertFilePath = `/public_html/seller_docs/${companyCertFileName}`;

      const stream = new Readable();
      stream.push(files['companyCertificate'][0].buffer);
      stream.push(null);

      await client.uploadFrom(stream, companyCertFilePath);
      fileUploads[
        'corporateBusinessAccount.companyCertificate'
      ] = `https://${process.env.FTP_HOST}/seller_docs/${companyCertFilePath}`;
    }

    Object.assign(sellerData, fileUploads);

    const seller = await Seller.findByIdAndUpdate(sellerId, sellerData, {
      new: true,
      runValidators: true
    });
    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    const updatedSeller = { ...seller._doc };
    delete updatedSeller.password;

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Seller profile updated successfully',
      data: updatedSeller
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

const updateSellerProfilePicture = async (req, res) => {
  let { profilePicture } = req.body;
  const sellerId = req.params.sellerId;
  const file = req.file;

  const client = new ftpClient.Client();
  client.ftp.verbose = true;

  try {
    const seller = await Seller.findById(sellerId);

    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    const protocol = 'https';
    const baseUrl = `${protocol}://${process.env.FTP_HOST}/`;

    const avatarMap = {
      Avatar1: 'profile_pictures/Avatar1.jpg',
      Avatar2: 'profile_pictures/Avatar2.jpg',
      Avatar3: 'profile_pictures/Avatar3.jpg',
      Avatar4: 'profile_pictures/Avatar4.jpg',
      Avatar5: 'profile_pictures/Avatar5.jpg',
      Avatar6: 'profile_pictures/Avatar6.jpg',
      Avatar7: 'profile_pictures/Avatar7.jpg',
      Avatar8: 'profile_pictures/Avatar8.jpg',
      Avatar9: 'profile_pictures/Avatar9.jpg',
      Avatar10: 'profile_pictures/Avatar10.jpg',
      Avatar11: 'profile_pictures/Avatar11.jpg'
    };

    if (avatarMap[profilePicture]) {
      seller.profilePicture = `${baseUrl}${avatarMap[profilePicture]}`;
    } else if (file) {
      await client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: false,
        port: process.env.FTP_PORT || 21
      });

      const uniqueFileName = `${Date.now()}-${file.originalname}`;
      const remoteFilePath = `/public_html/profile_pictures/${uniqueFileName}`;

      const stream = new Readable();
      stream.push(file.buffer);
      stream.push(null);

      await client.uploadFrom(stream, remoteFilePath);
      seller.profilePicture = `https://${process.env.FTP_HOST}/profile_pictures/${uniqueFileName}`;
    } else {
      return res
        .status(400)
        .json({ message: 'No valid profile picture provided' });
    }

    await seller.save();

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Profile picture updated successfully',
      data: seller.profilePicture
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

const changeSellerPassword = async (req, res) => {
  const sellerId = req.params.sellerId;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: 'Current password and new password are required' });
  }

  try {
    const seller = await Seller.findById(sellerId);

    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    const isPasswordMatch = await bcrypt.compare(
      currentPassword,
      seller.password
    );
    if (!isPasswordMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const isSamePassword = await bcrypt.compare(newPassword, seller.password);
    if (isSamePassword) {
      return res.status(400).json({
        message: 'New password cannot be the same as the current password'
      });
    }

    const SALT_ROUND = parseInt(process.env.SALT_ROUNDS, 10);
    if (isNaN(SALT_ROUND)) {
      return res.status(500).json('Invalid SALT_ROUNDS environment variable');
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUND);

    seller.password = hashedPassword;
    await seller.save();

    res.status(200).json({
      status: 200,
      success: true,
      message: 'Password changed successfully'
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

module.exports = {
  sellerAccountUpdate,
  updateSellerProfilePicture,
  changeSellerPassword
};
