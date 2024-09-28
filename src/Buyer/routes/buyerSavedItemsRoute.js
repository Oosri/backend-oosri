const express = require("express");
const router = express.Router();
const buyerSavedItemsController = require('../../Buyer/controllers/buyerSavedItemsController');
const joiSchemaValidation = require('../../Buyer/middlewares/joiSchemaValidation');
const buyerSavedItemsSchema = require('../../Buyer/apiSchema/buyerSavedItemsSchema');
const accessControlValidation = require('../../Buyer/middlewares/accessControlValidation');

router.post('/',
    accessControlValidation.validateToken,
    joiSchemaValidation.validateBody(buyerSavedItemsSchema.createBuyerSavedItemsSchema),
    buyerSavedItemsController.buyerSavedItems
);

router.get('/',
    accessControlValidation.validateToken,
    buyerSavedItemsController.retrieveBuyerSavedItems
);

router.delete('/:productId',
    accessControlValidation.validateToken,
    buyerSavedItemsController.removeBuyerSavedItems
);

module.exports = router;
