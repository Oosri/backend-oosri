const buyerProductReview = require('../../Buyer/models/buyerProductReviewModel');
const constants = require('../constants');

module.exports = {

  listAllReviews: async ({ status, page = 1, limit = 20 }) => {
    try {
      const filter = status ? { status } : {};
      const skip = (page - 1) * limit;

      const [reviews, total] = await Promise.all([
        buyerProductReview
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('productId', 'productName')
          .populate('userId', 'fullName email')
          .lean(),
        buyerProductReview.countDocuments(filter),
      ]);

      const formatted = reviews.map((r) => ({
        id: r._id,
        review: r.review,
        reviewer: r.reviewer,
        reviewerEmail: r.reviewerEmail,
        productRating: r.productRating,
        reviewDate: r.reviewDate,
        status: r.status,
        moderatedAt: r.moderatedAt,
        product: r.productId
          ? { id: r.productId._id, name: r.productId.productName }
          : null,
        buyer: r.userId
          ? { id: r.userId._id, name: r.userId.fullName, email: r.userId.email }
          : null,
      }));

      return {
        reviews: formatted,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          pageSize: limit,
          total,
        },
      };
    } catch (error) {
      console.error('Service: adminReview.listAllReviews', error);
      throw new Error(error);
    }
  },


  moderateReview: async ({ id, status, adminId }) => {
    try {
      if (!['active', 'flagged', 'hidden'].includes(status)) {
        throw new Error(constants.adminReviewMessage.INVALID_STATUS);
      }

      const review = await buyerProductReview.findById(id);
      if (!review) {
        throw new Error(constants.adminReviewMessage.REVIEW_NOT_FOUND);
      }

      review.status = status;
      review.moderatedBy = adminId;
      review.moderatedAt = new Date();
      await review.save();

      return {
        id: review._id,
        status: review.status,
        moderatedAt: review.moderatedAt,
      };
    } catch (error) {
      console.error('Service: adminReview.moderateReview', error);
      throw new Error(error);
    }
  },


  deleteReview: async ({ id }) => {
    try {
      const review = await buyerProductReview.findById(id);
      if (!review) {
        throw new Error(constants.adminReviewMessage.REVIEW_NOT_FOUND);
      }
      await buyerProductReview.findByIdAndDelete(id);
      return [];
    } catch (error) {
      console.error('Service: adminReview.deleteReview', error);
      throw new Error(error);
    }
  },
};
