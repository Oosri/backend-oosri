const express = require("express");
const { approveProduct } = require('../controllers/productController');
const { adminAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post("/product/:productId/approve", adminAuth, approveProduct)

module.exports = router