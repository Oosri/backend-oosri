const express = require("express");
const router = express.Router();
const productController = require('../controllers/buyerProductController');
const joiSchemaValidation = require('../middlewares/joiSchemaValidation');
const productSchema = require('../apiSchema/buyerProductSchema');
const accessControlValidation = require('../../Buyer/middlewares/accessControlValidation');
const validateObjectId = require('../../middlewares/validateObjectId');




router.get('/',
 joiSchemaValidation.validateQueryParams(productSchema.retrieveAllProductSchema), 
productController.retrieveAllProducts
);

router.get('/search', 
  productController.searchProducts
);

router.get('/:id',
    validateObjectId('id'),
    productController.retrieveProductById
  );

 router.post('/sync', 
   accessControlValidation.validateToken, 
  productController.syncProductsToAlgolia);
  

  
module.exports = router;    