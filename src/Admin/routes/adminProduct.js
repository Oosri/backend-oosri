const express = require("express");
const adminController = require('../controllers/adminProduct');


const router = express.Router();

// TO-DO Task
// Add admin middleware to all endpoints in this file

router.get('/products', adminController.getAllProducts);
router.post("/product/:productId", adminController.approveProduct) 

router.get('/', adminController.getAllProducts);
// router.post("/product/:productId/approve", adminAuth, approveProduct) 


  
module.exports = router;    