const express = require('express');
const sellerAuth = require('./sellerAuth.route');
const buyerAuth = require('../Buyer/routes/buyerAuthRoute');
const productRoutes = require('./product.route');
const buyerProfileRoutes = require('../Buyer/routes/buyerProfileRoute');
const buyerProductRoutes = require('../Buyer/routes/buyerProductRoute');
const buyerProductReviewRoutes = require('../Buyer/routes/buyerProductReviewRoute');
const buyerSavedItemsRoutes = require('../Buyer/routes/buyerSavedItemsRoute');
const buyerCartRoutes = require('../Buyer/routes/buyerCartRoute');
const buyerContactUsRoutes = require('../Buyer/routes/buyerContactUsRoutes');
const buyerOrderRoutes = require('../Buyer/routes/buyerOrderRoute');
const settingsRoutes = require('./sellerProfile.route');
const categoryRoutes = require('./category.route');
const buyerPaymentServiceRoutes = require('../Buyer/routes/buyerPaymentRoute');
const adminAuthRoutes = require('../Admin/routes/adminAuthRoute');
const adminProductRoute = require('../Admin/routes/adminProductRoute');
const dashboardRoutes = require('./dashboard.route');
const buyerFedexRoute = require('../Buyer/routes/buyerFedexRoutes');
const adminProfileRoute = require('../Admin/routes/adminProfileRoute');
const adminOrderRoutes = require('../Admin/routes/adminOrderRoute');
const courierServiceRoutes = require('../Admin/routes/courierServiceRoutes');

const adminSaleAnalyticsRoutes = require('../Admin/routes/adminSalesAnalyticsRoute');

const adminDashboardRoutes = require('../Admin/routes/adminDashboardRoute');
const adminSellerRoute = require('../Admin/routes/adminSellerRoute');
const sellerOrderRoutes = require('./order.route');
const buyerDHLRoutes = require('../Buyer/routes/buyerDHLRoutes');
const buyerShippingProviderRoutes = require('../Buyer/routes/buyerShippingProviderRoutes');
const bankRoutes = require('./bank.route');
const attributeRoutes = require('./attribute.route');
const adminFxRoute = require('../Admin/routes/adminFxRoute');
const uploadRoutes = require('./upload.route');
const discussionRoutes = require('../Community/routes/discussion.route');
const negotiationRoutes = require('../Community/routes/negotiation.route');
const adminSettingsRoute = require('../Admin/routes/adminSettingsRoute');
const adminHealthRoute = require('../Admin/routes/adminHealthRoute');
const adminBuyerRoute = require('../Admin/routes/adminBuyerRoute');
const adminPayoutRoute = require('../Admin/routes/adminPayoutRoute');
const adminNotificationRoute = require('../Admin/routes/adminNotificationRoute');
const adminManagementRoute = require('../Admin/routes/adminManagementRoute');
const adminReturnRoute = require('../Admin/routes/adminReturnRoute');
const buyerReturnRoute = require('../Buyer/routes/buyerReturnRoute');
const adminKycRoute = require('../Admin/routes/adminKycRoute');
const sellerKycRoute = require('./sellerKyc.route');
const sellerNotificationRoute = require('./sellerNotification.route');
const buyerNotificationRoute = require('../Buyer/routes/buyerNotificationRoute');

const router = express.Router();

router.get('/', (req, res) => {
  res.send('Server is running!');
});

router.use('/auth/seller', sellerAuth);
router.use('/auth/buyer', buyerAuth);
router.use('/auth/admin', adminAuthRoutes);

router.use('/profile/buyer', buyerProfileRoutes);
router.use('/profile/admin', adminProfileRoute);

router.use('/products/seller', productRoutes);
router.use('/products/buyer', buyerProductRoutes);
router.use('/products/admin', adminProductRoute);

router.use('/buyer/review', buyerProductReviewRoutes);
router.use('/buyer/saved-items', buyerSavedItemsRoutes);
router.use('/buyer/cart', buyerCartRoutes);
router.use('/buyer/contact-us', buyerContactUsRoutes);

router.use('/buyer/order', buyerOrderRoutes);
router.use('/admin/order', adminOrderRoutes);

router.use('/admin/analytics', adminSaleAnalyticsRoutes);

router.use('/seller/order', sellerOrderRoutes);

router.use('/buyer/shipping', buyerFedexRoute);
router.use('/buyer/dhl-shipping', buyerDHLRoutes);
router.use('/buyer/shipping-provider', buyerShippingProviderRoutes);
router.use('/categories', categoryRoutes);
router.use('/buyer/payment', buyerPaymentServiceRoutes);
router.use('/seller/dashboard', dashboardRoutes);
router.use('/settings/seller', settingsRoutes);

router.use('/admin/dashboard', adminDashboardRoutes);
router.use('/admin/sellers', adminSellerRoute);
router.use('/admin/courier-services', courierServiceRoutes);
router.use('/admin/fx', adminFxRoute);
router.use('/bank', bankRoutes); // Register bank routes
router.use('/attributes', attributeRoutes);
router.use('/upload', uploadRoutes);
router.use('/community/discussions', discussionRoutes);
router.use('/community/negotiations', negotiationRoutes);
router.use('/admin/settings', adminSettingsRoute);
router.use('/admin/health',   adminHealthRoute);
router.use('/admin/buyers',   adminBuyerRoute);
router.use('/admin/payouts',  adminPayoutRoute);
router.use('/admin/notifications', adminNotificationRoute);
router.use('/admin/admins', adminManagementRoute);
router.use('/admin/returns', adminReturnRoute);
router.use('/buyer/returns', buyerReturnRoute);
router.use('/admin/kyc', adminKycRoute);
router.use('/seller/kyc', sellerKycRoute);
router.use('/seller/notifications', sellerNotificationRoute);
router.use('/buyer/notifications', buyerNotificationRoute);

module.exports = router;
