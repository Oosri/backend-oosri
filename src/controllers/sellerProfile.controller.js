const Seller = require('../models/sellerModel');
const ftpClient = require('basic-ftp');
const fs = require('fs');
const path = require('path');

const sellerAccountUpdate = async (req, res) => {
  const client = new ftpClient.Client();
  const sellerId = req.params.sellerId;
  const sellerData = req.body;

  const protocol = 'https';
  const baseUrl = `${protocol}://${process.env.FTP_HOST}/seller_docs/`;

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: false,
      port: process.env.FTP_PORT || 21
    });

    const remoteDirPath = '/public_html/seller_docs/';
    await client.ensureDir(remoteDirPath);

    const uploadDir = path.join(__dirname, '../../public_html/seller_docs');
    let fileUploads = {};

    if (req.files['countryIdentificationCard']) {
      const countryIdFile = req.files['countryIdentificationCard'][0];
      const countryIdFileName = `${Date.now()}_${countryIdFile.originalname}`;
      const countryIdFilePath = path.join(uploadDir, countryIdFileName);

      fs.renameSync(countryIdFile.path, countryIdFilePath);
      await client.uploadFrom(
        countryIdFilePath,
        `${remoteDirPath}${countryIdFileName}`
      );

      fileUploads.countryIdentificationCard = `${baseUrl}${countryIdFileName}`;
    }

    if (req.files['vatCertificate']) {
      const vatFile = req.files['vatCertificate'][0];
      const vatFileName = `${Date.now()}_${vatFile.originalname}`;
      const vatFilePath = path.join(uploadDir, vatFileName);

      fs.renameSync(vatFile.path, vatFilePath);
      await client.uploadFrom(vatFilePath, `${remoteDirPath}${vatFileName}`);

      fileUploads.vatCertificate = `${baseUrl}${vatFileName}`;
    }

    if (req.files['companyCertificate']) {
      const companyCertFile = req.files['companyCertificate'][0];
      const companyCertFileName = `${Date.now()}_${
        companyCertFile.originalname
      }`;
      const companyCertFilePath = path.join(uploadDir, companyCertFileName);

      fs.renameSync(companyCertFile.path, companyCertFilePath);
      await client.uploadFrom(
        companyCertFilePath,
        `${remoteDirPath}${companyCertFileName}`
      );

      fileUploads.companyCertificate = `${baseUrl}${companyCertFileName}`;
    }

    const seller = await Seller.findByIdAndUpdate(sellerId, sellerData, {
      new: true
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
  const client = new ftpClient.Client();
  const { profilePicture } = req.body;
  const sellerId = req.params.sellerId;

  try {
    const seller = await Seller.findById(sellerId);

    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    const protocol = 'https';
    const baseUrl = `${protocol}://${process.env.FTP_HOST}/profile_pictures/`;

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
    } else if (req.file) {
      const uploadDir = path.join(
        __dirname,
        '../../public_html/profile_pictures'
      );
      const fileName = `${Date.now()}_${req.file.originalname}`;
      const filePath = path.join(uploadDir, fileName);

      fs.renameSync(req.file.path, filePath);

      seller.profilePicture = `profile_pictures/${fileName}`;
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

  try {
    const seller = await Seller.findById(sellerId);

    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    const isMatch = await seller.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    if (await bcrypt.compare(newPassword, seller.password)) {
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
