const express = require('express');
const sellerAuth = require('./sellerAuth.route')
const buyerAuth = require('../Buyer/routes/buyerAuthRoute')
const buyerProfile = require('../Buyer/routes/buyerProfileRoute')

const router = express.Router();

router.get('/', (req, res) => {
    res.send('Server is running!');
});

router.use('/auth/seller', sellerAuth);
router.use('/auth/buyer', buyerAuth);
router.use('/profile/buyer', buyerProfile);

module.exports = router