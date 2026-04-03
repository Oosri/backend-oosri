const express = require("express");
const router = express.Router();
const buyerFedexController = require("../controllers/buyerFedexController");
const joiSchemaValidation = require('../../Buyer/middlewares/joiSchemaValidation');
const buyerFedexSchema = require('../apiSchema/buyerFedexSchema')


router.post("/rate", 
joiSchemaValidation.validateBody(buyerFedexSchema.getShippingFeeSchema), 
buyerFedexController.calculateShipping);

module.exports = router;
