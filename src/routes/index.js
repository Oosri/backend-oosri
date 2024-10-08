const express = require('express');
const sellerAuth = require('./sellerAuth.route');
const buyerAuth = require('../Buyer/routes/buyerAuthRoute');
const productRoutes = require('./product.route');
const adminRoutes = require('./admin.route');
const buyerProfileRoutes = require('../Buyer/routes/buyerProfileRoute');
const buyerProductRoutes = require('../Buyer/routes/buyerProductRoute');
const buyerProductReviewRoutes = require('../Buyer/routes/buyerProductReviewRoute');
const buyerSavedItemsRoutes = require('../Buyer/routes/buyerSavedItemsRoute');
const buyerCartRoutes = require('../Buyer/routes/buyerCartRoute');
const buyerContactUsRoutes = require('../Buyer/routes/buyerContactUsRoutes');
const settingsRoutes = require('./sellerProfile.route');



const router = express.Router();

router.get('/', (req, res) => {
    res.send('Server is running!');
});

router.use('/auth/seller', sellerAuth);
router.use('/auth/buyer', buyerAuth);
router.use('/profile/buyer', buyerProfileRoutes);
router.use('/products/seller', productRoutes);
router.use('/products/buyer', buyerProductRoutes);
router.use('/admin', adminRoutes);
router.use('/buyer/review', buyerProductReviewRoutes);
router.use('/buyer/saved-items', buyerSavedItemsRoutes);
router.use('/buyer/cart', buyerCartRoutes);
router.use('/buyer/contact-us', buyerContactUsRoutes);
router.use('/settings/seller', settingsRoutes);

module.exports = router