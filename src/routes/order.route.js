const express = require('express');
const router = express.Router();
const { sellerAuth } = require('../middlewares/auth.middleware');
const {
  listOrders,
  getOrderDetails
} = require('../controllers/orderController');
const validateObjectId = require('../middlewares/validateObjectId');

router.get('/', sellerAuth, listOrders);
router.get('/:id', sellerAuth, validateObjectId('id'), getOrderDetails);

module.exports = router;
