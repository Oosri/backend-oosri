const { Category } = require('../../models/categoryModel');
const { Product } = require('../../models/productModel');
const constants = require('../constants');
const mongoDbDataFormat = require('../../Buyer/helper/dbHelper');

module.exports = {
  getAllProducts: async ({ category, subcategory, page = 1, limit = 10 }) => {
    try {

      let query = {};

      if (category) {
        const categoryExists = await Category.findOne({ name: category });

        query.category = category;

        if (subcategory) {
          const subCategoryExists = categoryExists.subcategories.some(
            (sub) => sub.name === subcategory
          );

          query.subcategory = subcategory;
        }
      }

      const currentPage = Math.max(1, parseInt(page, 10));
      const pageSize = Math.max(1, parseInt(limit, 10));
      const skip = (currentPage - 1) * pageSize;

      const products = await Product.find(query).limit(pageSize).skip(skip);

      const total = await Product.countDocuments(query);

      return {
        products,
        pagination: {
          total,
          currentPage,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      console.error('Something went wrong: Service: getAllProducts', error);
      throw new Error('Failed to retrieve products');
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
  }
};
