const buyerSavedItems = require('../../Buyer/models/buyerSavedItemsModel');
const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const buyerProductReview = require('../../Buyer/models/buyerProductReviewModel')
const fxService = require('./adminControlledFxService'); // Import admin-controlled FX service

/**
 * Add USD prices to product object
 * @param {Object} product - Product object with NGN prices
 * @param {Number} fxRate - NGN to USD exchange rate
 * @returns {Object} Product with added USD price fields
 */
function addUSDPrices(product, fxRate) {
  if (!fxRate) return product;

  const convertToUSD = (amountNGN) => {
    if (!amountNGN || amountNGN === 0) return null;
    return Number((amountNGN * fxRate).toFixed(2));
  };

  return {
    ...product,
    regularPriceUSD: convertToUSD(product.regularPrice || product.productPrice),
    discountPriceUSD: convertToUSD(product.discountPrice),
    salesPriceUSD: convertToUSD(product.salesPrice),
    previousPriceUSD: convertToUSD(product.previousPrice),
    fxRate: fxRate,
  };
}

function getBrandName(product) {
  return product?.productBrand || product?.brandArtist || product?.artist || 'Unknown Brand';
}

module.exports = {
  buyerSavedItems: async (serviceData) => {
    try {
      const product = await Product.findById(serviceData.productId);
      if (!product) {
        throw new Error(constants.buyerProductMessage.PRODUCT_NOT_FOUND);
      }
      const productReview = await buyerProductReview.findOne({ productId: serviceData.productId });

      const productRating = productReview ? productReview.productRating : 0;

      const existingWishlistItem = await buyerSavedItems.findOne({
        userId: serviceData.userId,
        productId: serviceData.productId,
      });
      if (existingWishlistItem) {
        throw new Error(constants.buyerSavedItemsMessage.BUYER_SAVED_ITEM_EXIST);
      }
      const saveItemData = {
        ...serviceData,
        productName: product.productName,
        productPrice: product.price,
        productRating: productRating
      };
      const saveItem = new buyerSavedItems(saveItemData);
      const result = await saveItem.save();

      return mongoDbDataFormat.formatMongoData(result);
    } catch (error) {
      console.error('Something went wrong: Service: buyerSavedItems ', error);
      throw new Error(error.message);
    }
  },

  retrieveBuyerSavedItems: async (userId, page = 1, limit = 10) => {
    try {
      mongoDbDataFormat.checkObjectId(userId);

      const skip = (page - 1) * limit;

      // Count total saved items for pagination metadata
      const totalItems = await buyerSavedItems.countDocuments({ userId });
      const totalPages = Math.ceil(totalItems / limit);

      // Fetch FX rate for USD conversion
      let fxRate = null;
      try {
        fxRate = await fxService.getFxRateNGNtoUSD();
      } catch (fxError) {
        console.warn('Failed to fetch FX rate for USD conversion:', fxError.message);
      }

      let savedItems = await buyerSavedItems.find({ userId })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'productId',
          populate: [
            { path: 'category', select: 'name' },
            { path: 'subcategory', select: 'name' }
          ]
        });

      // Even if empty, we return the structure with metadata
      if (!savedItems || savedItems.length === 0) {
        return {
          savedItems: [],
          currentPage: page,
          totalPages: totalPages,
          totalItems: totalItems
        };
      }

      const formattedItems = await Promise.all(
        savedItems.map(async (item) => {
          let product = item.productId;

          if (!product || !product._id) return null;

          const sellerDetails = await mongoDbDataFormat.getSellerDetails(product.seller);
          const sellerName = sellerDetails
            ? `${sellerDetails.firstName} ${sellerDetails.lastName}`
            : 'Unknown Seller';

          const productReviews = await buyerProductReview.find({
            productId: product._id
          });

          let productRating = 0;
          if (productReviews.length > 0) {
            const validRatings = productReviews
              .map((review) => Number(review.productRating))
              .filter((rating) => !isNaN(rating));

            if (validRatings.length > 0) {
              const totalRating = validRatings.reduce((sum, rating) => sum + rating, 0);
              productRating = totalRating / validRatings.length;
              productRating = Math.round(productRating * 10) / 10;
            }
          }

          const productData = {
            _id: product._id,
            savedItemId: item._id, // Keep the saved item ID reference
            productName: product.productName,
            productPrice: product.regularPrice, // Backward compatibility
            regularPrice: product.regularPrice,
            salesPrice: product.salesPrice || product.regularPrice,
            previousPrice: product.previousPrice,
            productCategory: product.category?.name || product.category || null,
            productSubcategory: product.subcategory?.name || product.subcategory || null,
            brandName: getBrandName(product),
            sellerName: sellerName,
            productRating: productRating,
            productImages: product.images || [],
            createdAt: item.createdAt
          };

          // Add USD prices
          return addUSDPrices(productData, fxRate);
        })
      );

      return {
        savedItems: formattedItems.filter(item => item !== null),
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItems
      };

    } catch (error) {
      console.error('Something went wrong: Service:  retrieveBuyerSavedItems', error);
      throw new Error(error.message);
    }
  },


  removeBuyerSavedItems: async (userId, productId) => {
    try {
      mongoDbDataFormat.checkObjectId(userId);
      mongoDbDataFormat.checkObjectId(productId);


      const savedItem = await buyerSavedItems.findOne({ userId, productId });
      if (!savedItem) {
        throw new Error(constants.buyerSavedItemsMessage.ITEM_NOT_FOUND);
      }
      await buyerSavedItems.findByIdAndDelete(savedItem._id);
      return [];
    } catch (error) {
      console.error('Something went wrong: Service: removeBuyerSavedItems', error);
      throw new Error(error.message);
    }
  }

};
