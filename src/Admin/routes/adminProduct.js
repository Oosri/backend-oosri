const express = require("express");
const adminController = require('../controllers/adminProduct');
const { approveProduct } = require('../../controllers/productController');

const router = express.Router();

router.get('/products', adminController.getAllProducts);
// router.post("/product/:productId/approve", adminAuth, approveProduct) 

  
module.exports = router;    