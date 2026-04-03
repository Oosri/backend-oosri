const express = require('express');
const { sellerAuth } = require('../middlewares/auth.middleware');
const upload = require('../Buyer/middlewares/fileUploadMiddleware');
const {
  sellerAccountUpdate,
  updateSellerProfilePicture,
  changeSellerPassword
} = require('../controllers/sellerProfile.controller');

const { documentUpload, profilePictureUpload, handleMulterError } = require('../middlewares/cloudinaryUploadMiddleware');
const router = express.Router();

/**
 * @route   PUT /api/seller/profile/:sellerId
 * @desc    Update seller account with documents
 * @access  Private (sellerAuth)
 * 
 * Files stream directly to Cloudinary (NO MEMORY BUFFERING)
 */
router.put(
  '/profile/:sellerId',
  sellerAuth,
  documentUpload.fields([
    { name: 'countryIdentificationCard', maxCount: 1 },
    { name: 'vatCertificate', maxCount: 1 },
    { name: 'companyCertificate', maxCount: 1 }
  ]),
  handleMulterError,
  sellerAccountUpdate
);


/**
 * @route   PUT /api/seller/profile-picture/:sellerId
 * @desc    Update seller profile picture
 * @access  Private (sellerAuth)
 * 
 * Uses memory storage (small files + conditional logic)
 */
router.put(
  '/profile-picture/:sellerId',
  sellerAuth,
  profilePictureUpload.single('profilePicture'),
  handleMulterError,
  updateSellerProfilePicture
);

/**
 * @route   PUT /api/seller/change-password/:sellerId
 * @desc    Change seller password
 * @access  Private (sellerAuth)
 */
router.put('/change-password/:sellerId', sellerAuth, changeSellerPassword);

module.exports = router;