const express = require('express');
const sellerAuth = require('./sellerAuth.route');
const buyerAuth = require('../Buyer/routes/buyerAuthRoute');
const productRoutes = require('./product.route');
const adminRoutes = require('./admin.route');



const router = express.Router();

router.get('/', (req, res) => {
    res.send('Server is running!');
});

router.use('/auth/seller', sellerAuth);
router.use('/auth/buyer', buyerAuth);
router.use('/products', productRoutes);
router.use('/admin', adminRoutes);


module.exports = router