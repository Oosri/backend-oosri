const express = require("express");
const router = express.Router();
const buyerProductReviewController = require('../../Buyer/controllers/buyerProductReviewController');
const joiSchemaValidation = require('../../Buyer/middlewares/joiSchemaValidation');
const buyerProductReviewSchema = require('../../Buyer/apiSchema/buyerProductReviewSchema');
const accessControlValidation = require('../../Buyer/middlewares/accessControlValidation');

router.post('/',
    accessControlValidation.validateToken,
    joiSchemaValidation.validateBody(buyerProductReviewSchema.addProductReviewSchema),
    buyerProductReviewController.addProductReview
);

router.get('/product/:productId',
  buyerProductReviewController.retrieveProductsReview
);

router.get('/user-reviews', 
  accessControlValidation.validateToken,
  buyerProductReviewController.retrieveProductReviewsByBuyerId
);

router.get('/:id',
  buyerProductReviewController.retrieveProductReviewById
);

router.put('/:id',
  accessControlValidation.validateToken,
  joiSchemaValidation.validateBody(buyerProductReviewSchema.updateProductReviewSchema),
  buyerProductReviewController.updateProductReview
);

router.delete('/:id',
  accessControlValidation.validateToken,
  buyerProductReviewController.removeProductReview
);

module.exports = router;
