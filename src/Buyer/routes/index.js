const express = require('express');
const buyerAuth = require('./buyerAuthRoute')

const router = express.Router();

router.get('/', (req, res) => {
    res.send('Server is running!');
});

router.use('/auth/buyer', buyerAuth);


module.exports = router