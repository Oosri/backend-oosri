const express = require("express");
const router = express.Router();
const buyerCartController = require('../../Buyer/controllers/buyerCartController ');
const joiSchemaValidation = require('../../Buyer/middlewares/joiSchemaValidation');
const buyerCartSchema = require('../../Buyer/apiSchema/buyerCartSchema');
const accessControlValidation = require('../../Buyer/middlewares/accessControlValidation');


router.post('/',
  accessControlValidation.cartTokenValidation, 
  joiSchemaValidation.validateBody(buyerCartSchema.createCartSchema), 
  buyerCartController.addToCart 
);

router.get('/generate-cart-key',
  buyerCartController.generateUniqueCartKey
);

router.get('/:cartKey?', 
  accessControlValidation.optional,
   buyerCartController.retrieveUserCart
  );


router.post('/merge',
  accessControlValidation.validateToken,
   buyerCartController.mergeCarts
  );

router.delete('/item/:id',
   accessControlValidation.optional,
   buyerCartController.removeUserCartItem
  );

router.delete('/',
  accessControlValidation.validateToken,
  buyerCartController.clearCart
);

module.exports = router;
