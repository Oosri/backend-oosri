const express = require("express");
const router = express.Router();
const buyerCartController = require('../../Buyer/controllers/buyerCartController ');
const joiSchemaValidation = require('../../Buyer/middlewares/joiSchemaValidation');
const buyerCartSchema = require('../../Buyer/apiSchema/buyerCartSchema');
const accessControlValidation = require('../../Buyer/middlewares/accessControlValidation');


router.post('/',
  accessControlValidation.cartTokenValidation, 
  buyerCartController.generateCartKey, 
  joiSchemaValidation.validateBody(buyerCartSchema.createCartSchema), 
  buyerCartController.addToCart 
);


router.get('/',
  accessControlValidation.cartTokenValidation,
  buyerCartController.retrieveUserCart
);



router.post('/merge',
  accessControlValidation.validateToken,
   buyerCartController.mergeCarts
  );

router.delete('/:id',
  accessControlValidation.validateToken,
  buyerCartController.removeUserCart
);

module.exports = router;
