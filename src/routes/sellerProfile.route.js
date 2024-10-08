const express = require('express');
const { sellerAuth } = require('../middlewares/auth.middleware');
const upload = require('../Buyer/middlewares/fileUploadMiddleware');
const {
  sellerAccountUpdate,
  updateSellerProfilePicture,
  changeSellerPassword
} = require('../controllers/sellerProfile.controller');

const router = express.Router();

router.put(
  '/profile/:sellerId',
  sellerAuth,
  upload.fields([
    { name: 'countryIdentificationCard', maxCount: 1 },
    { name: 'vatCertificate', maxCount: 1 },
    { name: 'companyCertificate', maxCount: 1 }
  ]),
  sellerAccountUpdate
);
router.put(
  '/profile-picture/:sellerId',
  sellerAuth,
  upload.single('profilePicture'),
  updateSellerProfilePicture
);
router.put('/change-password/:sellerId', sellerAuth, changeSellerPassword);

module.exports = router;
