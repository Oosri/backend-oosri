const express = require('express');
const { sellerAuth, verifySeller } = require('../middlewares/auth.middleware');
const {
  createProduct,
  getSellerProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleProductVisibility,
  filterProducts,
  searchProducts
} = require('../controllers/productController');
const upload = require('../Buyer/middlewares/fileUploadMiddleware');

const router = express.Router();

router.post(
  '/add',
  sellerAuth,
  verifySeller,
  upload.array('images[]', 5),
  createProduct
);
router.get('/search', searchProducts);
router.get('/products', sellerAuth, getSellerProducts);
router.get('/filter', sellerAuth, filterProducts);
router.get('/:id', getProductById);
router.put(
  '/:id',
  sellerAuth,
  verifySeller,
  upload.array('images[]', 5),
  updateProduct
);
router.delete('/:id', sellerAuth, verifySeller, deleteProduct);
router.patch('/:id/visibility', sellerAuth, toggleProductVisibility);

module.exports = router;
