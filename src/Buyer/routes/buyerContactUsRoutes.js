const express = require('express');
const router = express.Router();
const buyerContactUsController = require('../controllers/buyerContactUsController');
const joiSchemaValidation = require('../middlewares/joiSchemaValidation');
const buyerContactUsSchema = require('../apiSchema/buyerContactUsSchema');

router.post('/',
  joiSchemaValidation.validateBody(buyerContactUsSchema.contactUs),
  buyerContactUsController.contactUs
);


module.exports = router;