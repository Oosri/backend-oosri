const express = require('express');
const {
  createDiscussion,
  getDiscussions,
  addReply,
  getReplies,
  toggleReaction,
  pinDiscussion,
  deleteDiscussion,
  reportContent,
} = require('../controllers/discussionController');
const { buyerAuth, sellerAuth, optionalAuth } = require('../middlewares/communityAuth');
const { discussionLimiter } = require('../middlewares/communityRateLimiter');
const contentFilter = require('../middlewares/contentFilter');

const router = express.Router();

// Public reads — optional auth so verified badges can be shown when logged in
router.get('/product/:productId', optionalAuth, getDiscussions);
router.get('/:discussionId/replies', optionalAuth, getReplies);

// Buyer writes
router.post('/', buyerAuth, discussionLimiter, contentFilter, createDiscussion);
router.post('/:discussionId/reply', buyerAuth, discussionLimiter, contentFilter, addReply);
router.post('/react/:targetId', buyerAuth, toggleReaction);
router.delete('/:discussionId', buyerAuth, deleteDiscussion);
router.post('/report', buyerAuth, reportContent);

// Seller-only actions
router.patch('/:discussionId/pin', sellerAuth, pinDiscussion);
router.post('/:discussionId/reply/seller', sellerAuth, discussionLimiter, contentFilter, addReply);
router.delete('/seller/:discussionId', sellerAuth, deleteDiscussion);

module.exports = router;
