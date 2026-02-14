const Seller = require('../models/sellerModel');
const { Readable } = require('stream');
const bcrypt = require('bcryptjs');

const { avatarMap } = require("../utils/avatarMap");

const {
  uploadSellerProfilePicture,
  deleteFromCloudinary,
  extractPublicId
} = require('../utils/cloudinary');



/**
 * Update seller account with document uploads
 * Documents are ALREADY uploaded to Cloudinary by middleware
 * @route PUT /api/seller/profile/:sellerId
 */
const sellerAccountUpdate = async (req, res) => {
  const sellerId = req.params.sellerId;
  const sellerData = req.body;
  const files = req.files;

  // ---- NEW guard: ensure at least one document is uploaded ----
  // REMOVED: This guard blocks updates that don't include files (e.g. bank details)
  // if (!files || (!files['countryIdentificationCard'] && !files['vatCertificate'] && !files['companyCertificate'])) {
  //   return res.status(400).json({
  //     status: 400,
  //     success: false,
  //     message: 'At least one document (countryIdentificationCard, vatCertificate, or companyCertificate) must be uploaded',
  //   });
  // }

  try {

    // Validate seller exists
    const existingSeller = await Seller.findById(sellerId);
    if (!existingSeller) {
      return res.status(404).json({
        status: 404,
        success: false,
        message: 'Seller not found'
      });
    }

    let fileUploads = {};

    if (files?.['countryIdentificationCard']?.[0]) {
      const countryIdUrl = await uploadSellerDocument(
        files['countryIdentificationCard'][0],
        'country_id',
        sellerId
      );
      fileUploads['personalBusinessAccount.countryIdentificationCard'] = countryIdUrl;
    }

    if (files?.['vatCertificate']?.[0]) {
      const vatCertUrl = await uploadSellerDocument(
        files['vatCertificate'][0],
        'vat_cert',
        sellerId
      );
      fileUploads['corporateBusinessAccount.vatCertificate'] = vatCertUrl;
    }

    if (files?.['companyCertificate']?.[0]) {
      const companyCertUrl = await uploadSellerDocument(
        files['companyCertificate'][0],
        'company_cert',
        sellerId
      );
      fileUploads['corporateBusinessAccount.companyCertificate'] = companyCertUrl;
    }

    Object.assign(sellerData, fileUploads);

    const seller = await Seller.findByIdAndUpdate(sellerId, sellerData, {
      new: true,
      runValidators: true
    });

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

/**
 * Update seller profile picture
 * Uses memory storage because of conditional avatar logic
 * @route PUT /api/seller/profile-picture/:sellerId
 */
const updateSellerProfilePicture = async (req, res) => {
  const avatarSelection = req.body.profilePicture;
  const file = req.file;
  const { sellerId } = req.params;

  try {
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({
        status: 404,
        success: false,
        message: 'Seller not found'
      });
    }

    console.log(seller, "SELLER IS HERE!")

    let newProfilePictureUrl;

    // -------- CASE 1: Avatar selected (text field) 
    if (avatarSelection && avatarMap[avatarSelection]) {
      newProfilePictureUrl = avatarMap[avatarSelection];

      // If previous picture was a cloudinary upload → delete it
      if (seller.profilePicture?.includes('cloudinary')) {
        const oldPublicId = extractPublicId(seller.profilePicture);
        if (oldPublicId) await deleteFromCloudinary(oldPublicId, 'image').catch(() => { });
      }
    }

    // -------- CASE 2: File upload --------
    else if (file) {
      // Delete old Cloudinary image if needed
      if (seller.profilePicture?.includes('cloudinary')) {
        const oldPublicId = extractPublicId(seller.profilePicture);
        if (oldPublicId) await deleteFromCloudinary(oldPublicId, 'image').catch(() => { });
      }

      // Upload new file to cloudinary
      newProfilePictureUrl = await uploadSellerProfilePicture(file, sellerId);
    }

    else {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Provide an avatar selection or a file upload.'
      });
    }

    seller.profilePicture = newProfilePictureUrl;
    await seller.save();

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Profile picture updated successfully',
      data: {
        profilePicture: newProfilePictureUrl
      }
    });

  } catch (error) {
    console.error('Profile picture update error:', error);
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Failed to update profile picture',
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

    const saltRounds = parseInt(process.env.SALT_ROUNDS, 10);
    if (isNaN(saltRounds)) {
      console.error('Invalid SALT_ROUNDS environment variable');
      return res
        .status(500)
        .json({ message: 'Server configuration error' });
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
