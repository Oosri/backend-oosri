const express = require('express');
const adminHealthController = require('../controllers/adminHealthController');
const { validateToken, isAdmin } = require('../middleware/accessControlValidation');

const router = express.Router();

router.get('/', validateToken, isAdmin, adminHealthController.checkHealth);

module.exports = router;
