const express = require("express");
const router = express.Router();
const productController = require('../controllers/buyerProductController');
const joiSchemaValidation = require('../middlewares/joiSchemaValidation');
const productSchema = require('../apiSchema/buyerProductSchema');
const accessControlValidation = require('../../Buyer/middlewares/accessControlValidation');




router.get('/',
 joiSchemaValidation.validateQueryParams(productSchema.retrieveAllProductSchema), 
productController.retrieveAllProducts
);

router.get('/search', 
  productController.searchProducts
);

router.get('/:id',
    productController.retrieveProductById
  );

 router.post('/sync', 
   accessControlValidation.validateToken,
  productController.syncProductsToAlgolia);
  

  
module.exports = router;    