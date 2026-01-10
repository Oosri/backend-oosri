const buyerSavedItems = require('../../Buyer/models/buyerSavedItemsModel');
const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const buyerProductReview = require('../../Buyer/models/buyerProductReviewModel');
const { getFxRateNGNtoUSD } = require('../Service/fxService');

function addUSDPrices(product, fxRate) {
  if (!fxRate) return product;

  const convertToUSD = (amountNGN) => {
    if (!amountNGN || amountNGN === 0) return null;
    return Number((amountNGN * fxRate).toFixed(2));
  };

  const price = product.productPrice || product.regularPrice;

  return {
    ...product,
    regularPriceUSD: convertToUSD(price),
    salesPriceUSD: convertToUSD(product.salesPrice),
    previousPriceUSD: convertToUSD(product.previousPrice),
    fxRate: fxRate
  };
}

module.exports = {
  buyerSavedItems: async (serviceData) => {
    try {
      const product = await Product.findById(serviceData.productId)
        .populate('category', 'name')
        .populate('subcategory', 'name');

      if (!product) {
        throw new Error(constants.buyerProductMessage.PRODUCT_NOT_FOUND);
      }

      const existingWishlistItem = await buyerSavedItems.findOne({
        userId: serviceData.userId,
        productId: serviceData.productId
      });
      if (existingWishlistItem) {
        throw new Error(
          constants.buyerSavedItemsMessage.BUYER_SAVED_ITEM_EXIST
        );
      }

      // Fetch FX rate for USD conversion
      let fxRate = null;
      try {
        fxRate = await getFxRateNGNtoUSD();
      } catch (fxError) {
        console.warn(
          'Failed to fetch FX rate for USD conversion:',
          fxError.message
        );
      }

      const productReview = await buyerProductReview.findOne({
        productId: serviceData.productId
      });
      const savedProductRating = productReview
        ? productReview.productRating
        : 0;

      const saveItemData = {
        ...serviceData,
        productName: product.productName,
        productPrice: product.regularPrice,
        productRating: savedProductRating
      };
      const saveItem = new buyerSavedItems(saveItemData);
      await saveItem.save();

      const sellerDetails = await mongoDbDataFormat.getSellerDetails(
        product.seller
      );
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
          const totalRating = validRatings.reduce(
            (sum, rating) => sum + rating,
            0
          );
          productRating = totalRating / validRatings.length;
          productRating = Math.round(productRating * 10) / 10;
        }
      }

      const productData = {
        _id: product._id,
        productName: product.productName,
        productPrice: product.regularPrice,
        previousPrice: product.previousPrice,
        productCategory: product.category?.name || null,
        productSubcategory: product.subcategory?.name || null,
        sellerName: sellerName,
        productRating: productRating,
        productImages: product.images || []
      };

      return addUSDPrices(productData, fxRate);
    } catch (error) {
      console.log('Something went wrong: Service: buyerSavedItems ', error);
      throw new Error(error.message);
    }
  },

  retrieveBuyerSavedItems: async (userId) => {
    try {
      mongoDbDataFormat.checkObjectId(userId);

      const savedItems = await buyerSavedItems.find({ userId });

      if (!savedItems || savedItems.length === 0) {
        return [];
      }

      const productIds = savedItems.map((item) => item.productId);

      const products = await Product.find({ _id: { $in: productIds } })
        .populate('category', 'name')
        .populate('subcategory', 'name');

      let fxRate = null;
      try {
        fxRate = await getFxRateNGNtoUSD();
      } catch (fxError) {
        console.warn(
          'Failed to fetch FX rate for USD conversion:',
          fxError.message
        );
      }

      const formattedProducts = await Promise.all(
        products.map(async (product) => {
          const sellerDetails = await mongoDbDataFormat.getSellerDetails(
            product.seller
          );
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
              const totalRating = validRatings.reduce(
                (sum, rating) => sum + rating,
                0
              );
              productRating = totalRating / validRatings.length;
              productRating = Math.round(productRating * 10) / 10;
            }
          }

          const productData = {
            _id: product._id,
            productName: product.productName,
            productPrice: product.regularPrice,
            previousPrice: product.previousPrice,
            productCategory: product.category?.name || null,
            productSubcategory: product.subcategory?.name || null,
            sellerName: sellerName,
            productRating: productRating,
            productImages: product.images || []
          };

          return addUSDPrices(productData, fxRate);
        })
      );

      return formattedProducts;
    } catch (error) {
      console.log(
        'Something went wrong: Service:  retrieveBuyerSavedItems',
        error
      );
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
      console.log(
        'Something went wrong: Service: removeBuyerSavedItems',
        error
      );
      throw new Error(error.message);
    }
  }
};
