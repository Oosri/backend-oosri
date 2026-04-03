const express = require('express');
const router = express.Router();
const { sellerAuth } = require('../middlewares/auth.middleware');
const {
  listOrders,
  getOrderDetails
} = require('../controllers/orderController');

router.get('/', sellerAuth, listOrders);
router.get('/:id', sellerAuth, getOrderDetails);

module.exports = router;
