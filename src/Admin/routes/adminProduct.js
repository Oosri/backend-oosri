const express = require("express");
const router = express.Router();
const adminController = require('../controllers/adminProduct');
const { approveProduct } = require('../../controllers/productController');

router.get('/', adminController.getAllProducts);
// router.post("/product/:productId/approve", adminAuth, approveProduct) 

  
module.exports = router;    