const express = require('express');
const sellerAuth = require('./sellerAuth.route')

const router = express.Router();

router.get('/', (req, res) => {
    res.send('Server is running!');
});

router.use('/auth/seller', sellerAuth);


module.exports = router