const buyerSavedItems = require('../../Buyer/models/buyerSavedItemsModel');
const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const buyerProductReview = require('../../Buyer/models/buyerProductReviewModel')


module.exports = {
  buyerSavedItems: async (serviceData) => {
    try {
      const product = await Product.findById(serviceData.productId);
      if (!product) {
        throw new Error(constants.productMessage.PRODUCT_NOT_FOUND);
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
      console.log('Something went wrong: Service: buyerSavedItems ', error);
      throw new Error(error.message);
    }
  },
  
  retrieveBuyerSavedItems : async (userId) => {
    try {
      mongoDbDataFormat.checkObjectId(userId);
  
      let savedItems = await buyerSavedItems.find({ userId })
  
      if (!savedItems || savedItems.length === 0) {
        return [];
      }
  
      let formattedItems = mongoDbDataFormat.formatMongoData(savedItems);
  
      return formattedItems;
    } catch (error) {
      console.log('Something went wrong: Service:  retrieveBuyerSavedItems', error);
      throw new Error(error.message);
    }
  },
  
  
  removeBuyerSavedItems : async (userId, productId) => {
    try {
      mongoDbDataFormat.checkObjectId(userId);
      mongoDbDataFormat.checkObjectId(productId);
  
      const savedItem = await buyerSavedItems.findOne({ userId, productId });
      if (!savedItem) {
        throw new Error(constants.buyerSavedItemsMessage.ITEM_NOT_FOUND);
      }
      await buyerSavedItems.findByIdAndDelete(savedItem._id);
      return mongoDbDataFormat.formatMongoData(savedItem);
    } catch (error) {
      console.log('Something went wrong: Service: removeBuyerSavedItems', error);
      throw new Error(error.message);
    }
  }
  
};