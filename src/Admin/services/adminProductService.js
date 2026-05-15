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

      const products = await Product.find(query)
        .populate('seller', 'firstName lastName email businessType')
        .populate('category')
        .populate('subcategory')
        .limit(pageSize)
        .skip(skip)
        .sort({ createdAt: -1 });

      const total = await Product.countDocuments(query);

      return {
        products: products.map((product) =>
          mongoDbDataFormat.formatMongoData(product)
        ),
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
      console.error('Something went wrong: Service: approveProduct', error);
      throw new Error(error);
    }
  },

  getProductById: async (productId) => {
    try {
      mongoDbDataFormat.checkObjectId(productId);

      const product = await Product.findById(productId).populate(
        'seller',
        'firstName lastName email businessType'
      );

      if (!product) {
        throw new Error(constants.adminProductMessage.PRODUCT_NOT_FOUND);
      }

      return mongoDbDataFormat.formatMongoData(product);
    } catch (error) {
      console.error('Something went wrong: Service: getProductById', error);
      if (
        error.message === constants.adminProductMessage.PRODUCT_NOT_FOUND ||
        error.message === constants.databaseMessage.INVALID_ID
      ) {
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
      if (
        error.message === constants.adminProductMessage.PRODUCT_NOT_FOUND ||
        error.message === constants.databaseMessage.INVALID_ID
      ) {
        throw error;
      }
      throw new Error(constants.adminProductMessage.PRODUCT_DELETE_ERROR);
    }
  },

  filterProducts: async ({
    category,
    subcategory,
    brandArtist,
    minPrice,
    maxPrice,
    keyword,
    sortBy,
    productStatus,
    isApproved,
    page = 1,
    limit = 10
  }) => {
    try {
      let query = {};

      if (category) query.category = category;
      if (subcategory) query.subcategory = subcategory;
      if (brandArtist)
        query.brandArtist = { $regex: brandArtist, $options: 'i' };

      if (minPrice || maxPrice) {
        query.regularPrice = {};
        if (minPrice) query.regularPrice.$gte = Number(minPrice);
        if (maxPrice) query.regularPrice.$lte = Number(maxPrice);
      }

      if (keyword) {
        query.$or = [
          { productName: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } }
        ];
      }

      if (productStatus) query.productStatus = productStatus;

      if (
        isApproved !== undefined &&
        isApproved !== null &&
        String(isApproved) !== ''
      ) {
        query.isApproved = String(isApproved).toLowerCase() === 'true';
      }

      let sort = { createdAt: -1 };
      if (sortBy) {
        const sortOptions = {
          price_asc: { regularPrice: 1 },
          price_desc: { regularPrice: -1 },
          newest: { createdAt: -1 },
          oldest: { createdAt: 1 },
          name_asc: { productName: 1 },
          name_desc: { productName: -1 }
        };
        if (sortOptions[sortBy]) {
          sort = sortOptions[sortBy];
        }
      }

      const currentPage = Math.max(1, parseInt(page, 10));
      const pageSize = Math.max(1, parseInt(limit, 10));
      const skip = (currentPage - 1) * pageSize;

      const products = await Product.find(query)
        .populate('seller', 'firstName lastName email businessType')
        .sort(sort)
        .limit(pageSize)
        .skip(skip);

      const total = await Product.countDocuments(query);

      return {
        products: products.map((product) =>
          mongoDbDataFormat.formatMongoData(product)
        ),
        pagination: {
          total,
          currentPage,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      console.error('Something went wrong: Service: filterProducts', error);
      throw new Error(constants.adminProductMessage.PRODUCT_FETCH_ERROR);
    }
  },

  toggleProductVisibility: async ({ productId, isVisible }) => {
    try {
      mongoDbDataFormat.checkObjectId(productId);

      if (typeof isVisible !== 'boolean') {
        throw new Error(constants.adminProductMessage.PRODUCT_ISVISIBLE);
      }

      const product = await Product.findByIdAndUpdate(
        productId,
        { isVisible },
        { new: true }
      );
      if (!product) {
        throw new Error(constants.adminProductMessage.PRODUCT_NOT_FOUND);
      }

      return mongoDbDataFormat.formatMongoData(product);
    } catch (error) {
      console.error(
        'Something went wrong: Service: toggleProductVisibility',
        error
      );
      throw new Error(constants.adminProductMessage.PRODUCT_VISIBLE_ERROR);
    }
  }
};
