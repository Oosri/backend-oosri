const express = require('express');
const router = express.Router();
const { sellerAuth } = require('../middlewares/auth.middleware');
const { getSellerStore, getSellerStoreProducts, updateStoreProfile } = require('../controllers/sellerPublicController');

router.get('/store/:identifier', getSellerStore);
router.get('/store/:identifier/products', getSellerStoreProducts);
router.put('/store-profile/:sellerId', sellerAuth, updateStoreProfile);

module.exports = router;
