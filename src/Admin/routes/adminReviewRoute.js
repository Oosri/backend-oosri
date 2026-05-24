const express = require('express');
const router = express.Router();
const adminReviewController = require('../controllers/adminReviewController');
const { validateToken, isAdmin } = require('../middleware/accessControlValidation');

router.get('/',
  validateToken,
  isAdmin,
  adminReviewController.getAllReviews
);

router.patch('/:id/moderate',
  validateToken,
  isAdmin,
  adminReviewController.moderateReview
);

router.delete('/:id',
  validateToken,
  isAdmin,
  adminReviewController.deleteReview
);

module.exports = router;
