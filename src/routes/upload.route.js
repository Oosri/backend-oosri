const express = require('express');
const { generateSignature } = require('../controllers/uploadController');

const router = express.Router();

router.get('/signature', generateSignature);

module.exports = router;
