const express = require("express");
const router = express.Router();
const productController = require('../controllers/buyerProductController');
const joiSchemaValidation = require('../middlewares/joiSchemaValidation');
const productSchema = require('../apiSchema/buyerProductSchema');




router.get('/',
 joiSchemaValidation.validateQueryParams(productSchema.retrieveAllProductSchema), 
productController.retrieveAllProducts
);



router.get('/:id',
    productController.retrieveProductById
  );

  

  
  
module.exports = router;    