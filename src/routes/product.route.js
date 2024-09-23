const express = require('express');
const { sellerAuth, verifySeller } = require('../middlewares/auth.middleware');
const { createProduct, getProducts, getProductById, updateProduct, deleteProduct } = require('../controllers/productController');
const { upload } = require('../utils/fileUpload');


const router = express.Router();

router.post('/add', sellerAuth, verifySeller, upload.array('images', 5), createProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.put('/:id', sellerAuth, verifySeller, updateProduct);
router.delete('/:id', sellerAuth, verifySeller, deleteProduct);


module.exports = router