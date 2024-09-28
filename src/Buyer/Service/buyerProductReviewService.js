const buyerProductReview = require('../../Buyer/models/buyerProductReviewModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const Buyer = require('../../Buyer/models/buyerAuthModel');
const mongoose = require('mongoose');
const constants = require('../constants');
const { Product } = require('../../models/productModel');



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
        throw new Error(constants.productMessage.PRODUCT_NOT_FOUND);
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
  
      return mongoDbDataFormat.formatMongoData(savedReview);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw new Error(error);
    }
  },
  
  
  retrieveProductsReview: async (productId) => {
    try {
      const filter = productId ? { productId } : {};
  
      const reviews = await buyerProductReview.find(filter);
  
      if (!reviews || reviews.length === 0) {
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
          reviews: []
        };
      }
  
      const totalReviews = reviews.length;
  
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
  
      return {
        ratingSummary: {
          totalReviews,
          productRatingPercentage
        },
        reviews: mongoDbDataFormat.formatMongoData(reviews)
      };
    } catch (error) {
      console.log('Something went wrong: Service: retrieveProductsReview', error);
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
      console.log('Something went wrong: Service: retrieveProductReviewById', error);
      throw new Error(error);
    }
  },
  
  
removeProductReview: async ({ id, userId }) => {
    try {
      mongoDbDataFormat.checkObjectId(id);
      const review = await buyerProductReview.findByIdAndDelete(id);
  
      if (!review) {
        throw new Error(constants.reviewMessage.REVIEW_NOT_FOUND);
      }
  
      if (review.userId.toString() !== userId) {
        throw new Error(constants.reviewMessage.REVIEW_UNAUTHORIZED);
      }
  
      return mongoDbDataFormat.formatMongoData(review);
    } catch (error) {
      console.log('Something went wrong: Service: removeProductReview', error);
      throw new Error(error);
    }
  },
  
  retrieveProductReviewsByBuyerId : async ({ userId }) => {
    try {
      mongoDbDataFormat.checkObjectId(userId);
      const review = await buyerProductReview.find({ userId }); 
      if (!review || review.length === 0) {
        return [];
      }
      return mongoDbDataFormat.formatMongoData(review);
    } catch (error) {
      console.log('Something went wrong: Service: retrieveProductReviewsByBuyerId', error);
      throw new Error(error);
    }
  }
};