const buyerProductReview = require('../../Buyer/models/buyerProductReviewModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const Buyer = require('../../Buyer/models/buyerAuthModel');
const mongoose = require('mongoose');
const constants = require('../constants');
const { Product } = require('../../models/productModel');
const SellerNotification = require('../../models/sellerNotificationModel');
const createNotificationService = require('../../utils/notificationService');
const sellerNotifSvc = createNotificationService(SellerNotification, 'sellerId');



module.exports = {

  addProductReview: async (serviceData) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const buyer = await Buyer.findById(serviceData.userId);
      if (!buyer) {
        throw new Error(constants.buyerAuthMessage.USER_NOT_FOUND);
      };
  
      const product = await Product.findById(serviceData.productId);
      if (!product) {
        throw new Error(constants.buyerProductMessage.PRODUCT_NOT_FOUND);
      }
  
      if (typeof serviceData.productRating !== 'number' || serviceData.productRating < 1 || serviceData.productRating > 5) {
        throw new Error(constants.reviewMessage.INVALID_RATE_NUMBER);
      }
  
      const reviewData = {
        ...serviceData,
        reviewer: buyer.fullName,
        reviewerEmail: buyer.email,
        reviewerImage: buyer.profileImage,
        reviewDate: mongoDbDataFormat.formatDate(Date.now())
      };
  
      let review = new buyerProductReview(reviewData);
      const savedReview = await review.save({ session });
  
      const productReviews = await buyerProductReview.find({
        productId: serviceData.productId,
      });
  
  
      let averageRating = 0;
      if (productReviews.length > 0) {
        const totalRating = productReviews.reduce((acc, review) => {
          return acc + (review.productRating || 0); 
        }, 0);
  
        averageRating = totalRating / productReviews.length;
      }
  
      await Product.findByIdAndUpdate(
        serviceData.productId,
        { productRating: averageRating },
        { new: true, session }
      );
  
      await session.commitTransaction();
      session.endSession();

      setImmediate(() => {
        if (product.seller) {
          sellerNotifSvc.create({
            ownerId: product.seller,
            type: 'new_review',
            title: 'New Review',
            message: `${buyer.fullName || 'A buyer'} left a ${serviceData.productRating}-star review on "${product.productName}".`,
            metadata: { productId: String(serviceData.productId), reviewId: String(savedReview._id) },
          }).catch(err => console.error('[ReviewNotification] failed:', err.message));
        }
      });

      return mongoDbDataFormat.formatMongoData(savedReview);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw new Error(error);
    }
  },
  
  
retrieveProductsReview: async (productId, page = 1, limit = 10) => {
  try {
    const filter = productId ? { productId, status: 'active' } : { status: 'active' };

    const reviews = await buyerProductReview.find(filter);

    const totalReviews = reviews.length;

    if (totalReviews === 0) {
      return {
        ratingSummary: {
          totalReviews: 0,
          productRatingPercentage: {
            "1": "0.00",
            "2": "0.00",
            "3": "0.00",
            "4": "0.00",
            "5": "0.00"
          }
        },
        reviews: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          pageSize: limit,
          totalReviews: 0
        }
      };
    }

    const ratingCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    reviews.forEach((review) => {
      const rating = review.productRating;
      if (ratingCount[rating] !== undefined) {
        ratingCount[rating]++;
      }
    });

    const productRatingPercentage = {};
    Object.keys(ratingCount).forEach((key) => {
      const percentage = (ratingCount[key] / totalReviews) * 100;
      productRatingPercentage[key] = percentage.toFixed(2);
    });

    const totalPages = Math.ceil(totalReviews / limit);
    const start = (page - 1) * limit;
    const paginatedReviews = reviews.slice(start, start + limit);

    return {
      ratingSummary: {
        totalReviews,
        productRatingPercentage
      },
      reviews: mongoDbDataFormat.formatMongoData(paginatedReviews),
      pagination: {
        currentPage: page,
        totalPages,
        pageSize: limit,
        totalReviews
      }
    };
  } catch (error) {
    console.error('Something went wrong: Service: retrieveProductsReview', error);
    throw new Error(error);
  }
},
  
  
  retrieveProductReviewById: async ({ id }) => {
    try {
      mongoDbDataFormat.checkObjectId(id);
      const review = await buyerProductReview.findById(id);
      if (!review) {
        throw new Error(constants.reviewMessage.REVIEW_NOT_FOUND);
      }
      return mongoDbDataFormat.formatMongoData(review);
    } catch (error) {
      console.error('Something went wrong: Service: retrieveProductReviewById', error);
      throw new Error(error);
    }
  },


  updateProductReview: async ({ id, userId, review, productRating }) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      mongoDbDataFormat.checkObjectId(id);

      const existingReview = await buyerProductReview.findById(id);
      if (!existingReview) {
        throw new Error(constants.reviewMessage.REVIEW_NOT_FOUND);
      }

      if (existingReview.userId.toString() !== userId.toString()) {
        throw new Error(constants.reviewMessage.REVIEW_UNAUTHORIZED);
      }

      if (typeof productRating !== 'number' || productRating < 1 || productRating > 5) {
        throw new Error(constants.reviewMessage.INVALID_RATE_NUMBER);
      }

      existingReview.review = review;
      existingReview.productRating = productRating;
      existingReview.reviewDate = mongoDbDataFormat.formatDate(Date.now());
      const updatedReview = await existingReview.save({ session });

      const allReviews = await buyerProductReview.find({ productId: existingReview.productId });
      const totalRating = allReviews.reduce((acc, r) => acc + (r.productRating || 0), 0);
      const averageRating = allReviews.length > 0 ? totalRating / allReviews.length : 0;

      await Product.findByIdAndUpdate(
        existingReview.productId,
        { productRating: averageRating },
        { new: true, session }
      );

      await session.commitTransaction();
      session.endSession();

      return mongoDbDataFormat.formatMongoData(updatedReview);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw new Error(error);
    }
  },


  removeProductReview: async ({ id, userId }) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      mongoDbDataFormat.checkObjectId(id);

      const review = await buyerProductReview.findById(id);
      if (!review) {
        throw new Error(constants.reviewMessage.REVIEW_NOT_FOUND);
      }

      if (review.userId.toString() !== userId.toString()) {
        throw new Error(constants.reviewMessage.REVIEW_UNAUTHORIZED);
      }

      const productId = review.productId;
      await buyerProductReview.findByIdAndDelete(review._id, { session });

      const remaining = await buyerProductReview.find({ productId });
      const averageRating = remaining.length > 0
        ? remaining.reduce((acc, r) => acc + (r.productRating || 0), 0) / remaining.length
        : 0;

      await Product.findByIdAndUpdate(productId, { productRating: averageRating }, { session });

      await session.commitTransaction();
      session.endSession();
      return [];
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Something went wrong: Service: removeProductReview', error);
      throw new Error(error);
    }
  },
  
  
  retrieveProductReviewsByBuyerId: async ({ userId, page = 1, limit = 10 }) => {
    try {
      mongoDbDataFormat.checkObjectId(userId);

      const skip = (page - 1) * limit;
      const [reviews, total] = await Promise.all([
        buyerProductReview
          .find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('productId', 'productName'),
        buyerProductReview.countDocuments({ userId }),
      ]);

      return {
        reviews: mongoDbDataFormat.formatMongoData(reviews),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          pageSize: limit,
          total,
        },
      };
    } catch (error) {
      console.error('Something went wrong: Service: retrieveProductReviewsByBuyerId', error);
      throw new Error(error);
    }
  }
};