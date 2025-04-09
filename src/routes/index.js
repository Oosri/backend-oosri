const express = require('express');
const sellerAuth = require('./sellerAuth.route');
const buyerAuth = require('../Buyer/routes/buyerAuthRoute');
const productRoutes = require('./product.route');
const adminProductRoutes = require('../Admin/routes/adminProduct');
const buyerProfileRoutes = require('../Buyer/routes/buyerProfileRoute');
const buyerProductRoutes = require('../Buyer/routes/buyerProductRoute');
const buyerProductReviewRoutes = require('../Buyer/routes/buyerProductReviewRoute');
const buyerSavedItemsRoutes = require('../Buyer/routes/buyerSavedItemsRoute');
const buyerCartRoutes = require('../Buyer/routes/buyerCartRoute');
const buyerContactUsRoutes = require('../Buyer/routes/buyerContactUsRoutes');
const buyerOrderRoutes = require('../Buyer/routes/buyerOrderRoute');
const settingsRoutes = require('./sellerProfile.route');
const categoryRoutes = require('./category.route');
const buyerPaymentServiceRoutes = require('../Buyer/routes/buyerPaymentServiceRoute');
const adminAuthRoutes = require('../Admin/routes/adminAuthRoute');
const adminProductRoute = require('../Admin/routes/adminProduct');
const dashboardRoutes = require('./dashboard.route');
const buyerFedexRoute = require('../Buyer/routes/buyerFedexRoutes')

const router = express.Router();

router.get('/', (req, res) => {
  res.send('Server is running!');
});

router.use('/auth/seller', sellerAuth);
router.use('/auth/buyer', buyerAuth);
router.use('/auth/admin', adminAuthRoutes);
router.use('/profile/buyer', buyerProfileRoutes);
router.use('/products/seller', productRoutes);
router.use('/products/buyer', buyerProductRoutes);
router.use('/products/admin', adminProductRoute);
router.use('/admin', adminProductRoutes);
router.use('/buyer/review', buyerProductReviewRoutes);
router.use('/buyer/saved-items', buyerSavedItemsRoutes);
router.use('/buyer/cart', buyerCartRoutes);
router.use('/buyer/contact-us', buyerContactUsRoutes);
router.use('/buyer/order', buyerOrderRoutes);
router.use('/buyer/shipping', buyerFedexRoute);
router.use('/categories', categoryRoutes);
router.use('/buyer/payment', buyerPaymentServiceRoutes);
router.use('/seller/dashboard', dashboardRoutes);
router.use('/settings/seller', settingsRoutes);

module.exports = router;
