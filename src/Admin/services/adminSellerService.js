const Seller = require('../../models/sellerModel');
const constants = require('../constants');
const mongoDbDataFormat = require('../helper/dbHelper');
const { Product } = require('../../models/productModel');

module.exports = {
getAllSellers: async ({ page = 1, limit = 10, searchTerm = '' }) => {
  try {
    const currentPage = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (currentPage - 1) * pageSize;

    const query = {};

    if (searchTerm && searchTerm.trim()) {
      const regex = new RegExp(searchTerm.trim(), 'i');
      query.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phone_number: regex },
        { country: regex }
      ];
    }

    const sellers = await Seller.find(query)
      .limit(pageSize)
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Seller.countDocuments(query);

    return {
      sellers: sellers.map((seller) =>
        mongoDbDataFormat.formatMongoData(seller)
      ),
      pagination: {
        total,
        currentPage,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  } catch (error) {
    console.error('Something went wrong: Service: getAllSellers', error);
    throw new Error(constants.adminSellerMessage.SELLER_FETCH_ERROR);
  }
},

  getSellerById: async (sellerId) => {
    try {
      mongoDbDataFormat.checkObjectId(sellerId);

      const seller = await Seller.findById(sellerId).select('-password');

      if (!seller) {
        throw new Error(constants.adminSellerMessage.SELLER_NOT_FOUND);
      }

      return mongoDbDataFormat.formatMongoData(seller);
    } catch (error) {
      console.error('Something went wrong: Service: getSellerById', error);
      if (
        error.message === constants.adminSellerMessage.SELLER_NOT_FOUND ||
        error.message === constants.databaseMessage.INVALID_ID
      ) {
        throw error;
      }
      throw new Error(constants.adminSellerMessage.SELLER_FETCH_ERROR);
    }
  },

  deleteSeller: async (sellerId) => {
    try {
      mongoDbDataFormat.checkObjectId(sellerId);

      const seller = await Seller.findById(sellerId);
      if (!seller) {
        throw new Error(constants.adminSellerMessage.SELLER_NOT_FOUND);
      }

      await Product.deleteMany({ sellerId: seller });

      const sellerDeletionResult = await Seller.deleteOne({ _id: sellerId });

      if (sellerDeletionResult.deletedCount === 0) {
        throw new Error(constants.adminSellerMessage.SELLER_NOT_FOUND);
      }

      return;
    } catch (error) {
      console.error('Something went wrong: Service: deleteSeller', error);
      if (
        error.message === constants.adminSellerMessage.SELLER_NOT_FOUND ||
        error.message === constants.databaseMessage.INVALID_ID
      ) {
        throw error;
      }
      throw new Error(constants.adminSellerMessage.SELLER_DELETE_ERROR);
    }
  },

  filterSellers: async ({
    firstName,
    lastName,
    email,
    keyword,
    sortBy,
    page = 1,
    limit = 10
  }) => {
    try {
      let query = {};

      if (firstName) query.firstName = { $regex: firstName, $options: 'i' };
      if (lastName) query.lastName = { $regex: lastName, $options: 'i' };
      if (email) query.email = { $regex: email, $options: 'i' };
      if (keyword) {
        query.$or = [
          { productName: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } }
        ];
      }

      let sort = { createdAt: -1 };
      if (sortBy) {
        const sortOptions = {
          newest: { createdAt: -1 },
          oldest: { createdAt: 1 },
          name_asc: { firstName: 1, lastName: 1 },
          name_desc: { firstName: -1, lastName: -1 }
        };
        if (sortOptions[sortBy]) {
          sort = sortOptions[sortBy];
        }
      }

      const currentPage = Math.max(1, parseInt(page, 10));
      const pageSize = Math.max(1, parseInt(limit, 10));
      const skip = (currentPage - 1) * pageSize;

      const sellers = await Seller.find(query)
        .sort(sort)
        .limit(pageSize)
        .skip(skip);

      const total = await Product.countDocuments(query);

      return {
        sellers: sellers.map((seller) =>
          mongoDbDataFormat.formatMongoData(seller)
        ),
        pagination: {
          total,
          currentPage,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      console.error('Something went wrong: Service: filterSellers', error);
      throw new Error(constants.adminSellerMessage.SELLER_FETCH_ERROR);
    }
  }
};
