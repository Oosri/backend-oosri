const express = require("express");
const router = express.Router();
const buyerDHLController = require("../controllers/buyerDHLController");
const joiSchemaValidation = require('../../Buyer/middlewares/joiSchemaValidation');
const buyerDHLSchema = require('../../Buyer/apiSchema/buyerDHLSchema');


router.post("/validate-address", 
joiSchemaValidation.validateBody(buyerDHLSchema.validateDHLAddressSchema), 
buyerDHLController.validateDHLAddress);
router.post("/get-rate", 
joiSchemaValidation.validateBody(buyerDHLSchema.getDHLRateSchema), 
buyerDHLController.getDHLRate);

module.exports = router;
