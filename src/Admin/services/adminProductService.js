const { Category } = require('../../models/categoryModel');
const { Product } = require('../../models/productModel');
const constants = require('../constants');
const mongoDbDataFormat = require('../../Buyer/helper/dbHelper');

module.exports = {
  getAllProducts: async ({ category, subcategory, page = 1, limit = 10 }) => {
    try {

      let query = {};

      if (category) {
        query.category = category;

        if (subcategory) {
          query.subcategory = subcategory;
        }
      }

      const currentPage = Math.max(1, parseInt(page, 10));
      const pageSize = Math.max(1, parseInt(limit, 10));
      const skip = (currentPage - 1) * pageSize;

      const products = await Product.find(query).populate('sellerId', 'firstName lastName email businessType').limit(pageSize).skip(skip).sort({ createdAt: -1 });

      const total = await Product.countDocuments(query);

      return {
        products: products.map(product => mongoDbDataFormat.formatMongoData(product)),
        pagination: {
          total,
          currentPage,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      console.error('Something went wrong: Service: getAllProducts', error);
      throw new Error(constants.adminProductMessage.PRODUCT_FETCH_ERROR);
    }
  },

  approveProduct: async (productId) => {
    try {
      const { action } = req.body;
  
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error(constants.adminProductMessage.PRODUCT_NOT_FOUND);
      }
  
      if (action === 'approve') {
        product.isApproved = true;
        await product.save();
        return mongoDbDataFormat.formatMongoData(product);
      } else if (action === 'reject') {
        await product.remove();
        return [];
      } else {
        throw new Error(constants.adminProductMessage.PRODUCT_ACTION);
      }
    } catch (error) {
      console.log('Something went wrong: Service: approveProduct', error);
      throw new Error(error);
    }
  },

  getProductById: async (productId) => {
    try {
      mongoDbDataFormat.checkObjectId(productId);

      const product = await Product.findById(productId).populate('sellerId', 'firstName lastName email businessType');

      if (!product) {
        throw new Error(constants.adminProductMessage.PRODUCT_NOT_FOUND);
      }

      return mongoDbDataFormat.formatMongoData(product);
    } catch (error) {
      console.error('Something went wrong: Service: getProductById', error);
      if (error.message === constants.adminProductMessage.PRODUCT_NOT_FOUND || error.message === constants.databaseMessage.INVALID_ID) {
          throw error;
      }
      throw new Error(constants.adminProductMessage.PRODUCT_FETCH_ERROR);
    }
  },

  deleteProduct: async (productId) => {
    try {
      mongoDbDataFormat.checkObjectId(productId);

      const product = await Product.findById(productId);
      if (!product) {
        throw new Error(constants.adminProductMessage.PRODUCT_NOT_FOUND);
      }

      const result = await Product.deleteOne({ _id: productId });

      if (result.deletedCount === 0) {
         throw new Error(constants.adminProductMessage.PRODUCT_NOT_FOUND);
      }

      return;

    } catch (error) {
      console.error('Something went wrong: Service: deleteProduct', error);
      if (error.message === constants.adminProductMessage.PRODUCT_NOT_FOUND || error.message === constants.databaseMessage.INVALID_ID) {
          throw error;
      }
      throw new Error(constants.adminProductMessage.PRODUCT_DELETE_ERROR);
    }
  }
};
