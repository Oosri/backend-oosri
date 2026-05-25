const { Category } = require('../../models/categoryModel');
const { Product } = require('../../models/productModel');
const constants = require('../constants');
const mongoDbDataFormat = require('../../Buyer/helper/dbHelper');
const syncProduct = require('../../Buyer/Service/buyerProductService');
const SellerNotification = require('../../models/sellerNotificationModel');
const createNotificationService = require('../../utils/notificationService');
const sellerNotifSvc = createNotificationService(SellerNotification, 'sellerId');

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

  approveProduct: async (productId, action) => {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error(constants.adminProductMessage.PRODUCT_NOT_FOUND);
      }

      if (action === 'approve') {
        product.productStatus = 'approved';
        product.isApproved = true;
        const savedProduct = await product.save();
        setImmediate(async () => {
          try {
            await syncProduct.syncProductsToAlgolia(savedProduct);
          } catch (syncError) {
            console.error('Algolia sync failed on admin approval:', syncError);
          }
          if (product.seller) {
            sellerNotifSvc.create({
              ownerId: product.seller,
              type: 'product_approved',
              title: 'Product Approved',
              message: `Your product "${product.productName}" has been approved and is now live on the marketplace.`,
              metadata: { productId: String(productId) },
            }).catch(err => console.error('[ProductApprovalNotif] failed:', err.message));
          }
        });
        return 'approve';
      } else if (action === 'reject') {
        const sellerId = product.seller;
        const productName = product.productName;
        await Product.findByIdAndDelete(productId);
        setImmediate(async () => {
          try {
            await syncProduct.removeProductFromAlgolia(productId);
          } catch (syncError) {
            console.error('Algolia removal failed on admin rejection:', syncError);
          }
          if (sellerId) {
            sellerNotifSvc.create({
              ownerId: sellerId,
              type: 'product_rejected',
              title: 'Product Not Approved',
              message: `Your product "${productName}" was not approved. Please review our guidelines and resubmit.`,
              metadata: { productId: String(productId) },
            }).catch(err => console.error('[ProductRejectionNotif] failed:', err.message));
          }
        });
        return 'reject';
      } else {
        throw new Error(constants.adminProductMessage.PRODUCT_ACTION);
      }
    } catch (error) {
      console.error('Something went wrong: Service: approveProduct', error);
      throw new Error(error.message);
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
    sellerId,
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
      if (sellerId) query.seller = sellerId;

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

  updateProduct: async (productId, fields) => {
    try {
      mongoDbDataFormat.checkObjectId(productId);

      const product = await Product.findById(productId);
      if (!product) throw new Error(constants.adminProductMessage.PRODUCT_NOT_FOUND);

      const allowed = [
        'productName', 'productDescription', 'brandArtist', 'subcategory',
        'productType', 'regularPrice', 'salesPrice', 'discount', 'discountPrice',
        'inStock', 'weight', 'width', 'height', 'technique', 'yard', 'fabricType',
        'pattern', 'diameter', 'clayType', 'glaze', 'length', 'stoneType',
        'metalType', 'medium', 'condition', 'size',
      ];

      allowed.forEach((key) => {
        if (fields[key] !== undefined) product[key] = fields[key];
      });

      await product.save();
      return mongoDbDataFormat.formatMongoData(product);
    } catch (error) {
      if (
        error.message === constants.adminProductMessage.PRODUCT_NOT_FOUND ||
        error.message === constants.databaseMessage.INVALID_ID
      ) throw error;
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
