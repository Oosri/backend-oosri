const express = require('express');
const {
  createNegotiation,
  counterOffer,
  acceptNegotiation,
  rejectNegotiation,
  getBuyerNegotiations,
  getSellerNegotiations,
  validateCheckoutToken,
} = require('../controllers/negotiationController');
const { buyerAuth, sellerAuth } = require('../middlewares/communityAuth');
const { negotiationLimiter } = require('../middlewares/communityRateLimiter');

const router = express.Router();

// Buyer routes
router.post('/', buyerAuth, negotiationLimiter, createNegotiation);
router.get('/buyer', buyerAuth, getBuyerNegotiations);
router.post('/:negotiationId/accept', buyerAuth, acceptNegotiation);
router.post('/:negotiationId/reject', buyerAuth, rejectNegotiation);
router.get('/checkout/:token', buyerAuth, validateCheckoutToken);

// Seller routes
router.get('/seller', sellerAuth, getSellerNegotiations);
router.post('/:negotiationId/counter', sellerAuth, counterOffer);
router.post('/:negotiationId/accept/seller', sellerAuth, acceptNegotiation);
router.post('/:negotiationId/reject/seller', sellerAuth, rejectNegotiation);

module.exports = router;
