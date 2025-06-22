const { Product, Sculpture, Textiles, Pottery, Jewelry, Paintings } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const moment = require('moment');
const constants = require('../constants');
const algoliasearch = require('algoliasearch');
const buyerProductReview = require('../../Buyer/models/buyerProductReviewModel');
const mongoose = require('mongoose');


const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_SEARCH_API_KEY);

const index = client.initIndex(process.env.ALGOLIA_INDEX_NAME);

 module.exports = {

  retrieveAllProducts: async ({
    skip = 0,
    limit = 10,
    category,
    productName,
    subCategory,
    minPrice,
    maxPrice,
  }) => {
    try {
      let query = { isVisible: true };
  
      if (productName) {
        query.productName = { $regex: new RegExp(productName.trim(), 'i') };
      }
  
      if (category) {
        query.category = { $regex: new RegExp(category.trim(), 'i') };
      }
  
      if (subCategory) {
        query.subCategory = { $regex: new RegExp(subCategory.trim(), 'i') };
      }
  
      if (minPrice || maxPrice) {
        query.regularPrice = {};
        if (minPrice) {
          query.regularPrice.$gte = minPrice;
        }
        if (maxPrice) {
          query.regularPrice.$lte = maxPrice;
        }
      }
  
      const totalProducts = await Product.countDocuments(query);
      const products = await Product.find(query)
        .skip(parseInt(skip))
        .limit(parseInt(limit));
  
      const formattedProducts = await Promise.all(
        products.map(async (product) => {
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

          return {
            _id: product._id,
            productName: product.productName,
            productPrice: product.regularPrice,
            previousPrice:product.previousPrice,
            sellerName: sellerName,
            productRating: productRating,
            productImages: product.images || [],
          };
        })
      );
  
      return {
        products: formattedProducts,
        total: totalProducts,
        currentPage: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
        totalPages: Math.ceil(totalProducts / parseInt(limit)),
      };
    } catch (error) {
      console.error('Something went wrong: Service: retrieveAllProducts', error);
      throw new Error('Failed to retrieve products');
    }
  },
  

  retrieveProductById: async ({ id }) => {
    try {
      mongoDbDataFormat.checkObjectId(id);
  
      let product = await Product.findById(id);
  
      if (!product) {
        throw new Error(constants.buyerProductMessage.PRODUCT_NOT_FOUND);
      }
  
      const sellerDetails = await mongoDbDataFormat.getSellerDetails(product.seller);
      const sellerName = sellerDetails
        ? `${sellerDetails.firstName} ${sellerDetails.lastName}`
        : 'Unknown Seller';
  
      const previousPrice = product.previousPrice || product.regularPrice;
      const discountOff =
        previousPrice > product.regularPrice
          ? ((previousPrice - product.regularPrice) / previousPrice) * 100
          : 0;
  
      const baseFields = {
        Id: product._id,
        productId: product.productId,
        productName: product.productName,
        category: product.category,
        productDescription: product.productDescription,
        artist: product.brandArtist,
        country: product.country || 'N/A',
        condition: product.condition || 'N/A',
        quantity: product.quantity || 0,
        images: product.images,
        regularPrice: product.regularPrice,
        previousPrice: previousPrice,
        salesPrice: product.salesPrice || product.regularPrice,
        discount: product.discount || 0,
        discountOff: discountOff.toFixed(2),
        isApproved: product.isApproved,
        sellerName: sellerName,
        totalSales: product.total_sales || 0,
        createdAt: moment(product.createdAt).format('YYYY-MM-DD hh:mm:ss A'),
        updatedAt: moment(product.updatedAt).format('YYYY-MM-DD hh:mm:ss A'),
      };
  
      let categorySpecificFields = {};
  
      switch (product.category) {
        case 'Sculpture':
          categorySpecificFields = {
            height: product.height,
            width: product.width,
            weight: product.weight,
            technique: product.technique,
          };
          break;
        case 'Textiles':
          categorySpecificFields = {
            fabricType: product.fabricType,
            pattern: product.pattern,
            weight: product.weight,
            length: product.length,
            yard: product.yard
          };
          break;
        case 'Pottery':
          categorySpecificFields = {
            clayType: product.clayType,
            glaze: product.glaze,
            height: product.height,
            diameter: product.diameter,
          };
          break;
        case 'Jewelry':
          categorySpecificFields = {
            stoneType: product.stoneType,
            metalType: product.metalType,
            length: product.length,
            diameter: product.diameter,
          };
          break;
        case 'Paintings':
          categorySpecificFields = {
            medium: product.medium,
            condition: product.condition,
            size: product.size,
          };
          break;
        default:
          break;
      }
  
      const formattedProduct = {
        ...baseFields,
        ...categorySpecificFields,
      };
  
      return {
        product: mongoDbDataFormat.formatMongoData(formattedProduct),
      };
    } catch (error) {
      console.error('Something went wrong: Service: retrieveProductById', error);
      throw new Error('Failed to retrieve product');
    }
  },
  
  
  searchProducts: async (searchTerm, filters = null, skip = 0, limit = 10) => {
    try {
      if (!searchTerm) {
        throw new Error(constants.buyerProductMessage.SEARCH_TERM_REQUIRED);
      }
  
      const options = {
        offset: parseInt(skip),
        length: parseInt(limit),
      };
  
      if (filters) {
        options.filters = filters;
      }
  
      const result = await index.search(searchTerm, options);
  
      const formattedProducts = await Promise.all(
        result.hits.map(async (product) => {
          const sellerDetails = await mongoDbDataFormat.getSellerDetails(product.seller);
          const sellerName = sellerDetails
            ? `${sellerDetails.firstName} ${sellerDetails.lastName}`
            : 'Unknown Seller';
  
            const previousPrice = product.previousPrice || product.regularPrice;
            const discountOff =
              previousPrice > product.regularPrice
                ? ((previousPrice - product.regularPrice) / previousPrice) * 100
                : 0;
  
          const baseFields = {
            Id: product.objectID,
            product: product.productId,
            productName: product.productName,
            category: product.category || 'Miscellaneous',
            productDescription: product.productDescription || 'No description available',
            artist: product.artist || 'Unknown Artist',
            country: product.country || 'Unknown',
            condition: product.condition || 'Unknown',
            quantity: product.quantity || 0,
            images: product.images || [],
            price: product.price || 0,
            regularPrice: product.regularPrice || 0,
            discountOff: discountOff.toFixed(2), 
            isApproved: product.isApproved || false,
            sellerName: sellerName,
            createdAt: moment(product.createdAt).format('YYYY-MM-DD hh:mm:ss A'),
            updatedAt: moment(product.updatedAt).format('YYYY-MM-DD hh:mm:ss A'),
          };
  
          let categorySpecificFields = {};
  
          switch (product.category) {
            case 'Sculpture':
              categorySpecificFields = {
                height: product.height,
                width: product.width,
                weight: product.weight,
                technique: product.technique,
              };
              break;
            case 'Textiles':
              categorySpecificFields = {
                fabricType: product.fabricType,
                pattern: product.pattern,
                yard: product.yard,
                weight: product.weight,
              };
              break;
            case 'Pottery':
              categorySpecificFields = {
                clayType: product.clayType,
                glaze: product.glaze,
                height: product.height,
                diameter: product.diameter,
              };
              break;
            case 'Jewelry':
              categorySpecificFields = {
                stoneType: product.stoneType,
                metalType: product.metalType,
                length: product.length,
                diameter: product.diameter,
              };
              break;
            case 'Paintings':
              categorySpecificFields = {
                medium: product.medium,
                condition: product.condition,
                size: product.size,
              };
              break;
            default:
              break;
          }
  
          return { 
            ...baseFields, 
            ...categorySpecificFields 
          };
        })
      );
  
      return {
        products: mongoDbDataFormat.formatMongoData(formattedProducts),
        total: result.nbHits,
        currentPage: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
        totalPages: Math.ceil(result.nbHits / parseInt(limit)),
      };
    } catch (error) {
      console.error('Something went wrong: searchProducts', error);
      throw new Error('Search failed');
    }
  },
  

  
  syncProductsToAlgolia: async () => {
    try {
      const products = await Product.find().lean();

      if (!products || products.length === 0) {
        throw new Error('No products found to sync.');
      }

      const records = products.map((product) => {
        const baseFields = {
          objectID: product._id.toString(),
          product: product.productId,
          productName: product.productName,
          category: product.category || 'Miscellaneous',
          productDescription: product.productDescription || 'No description available',
          artist: product.artist || 'Unknown Artist',
          country: product.country || 'Unknown',
          condition: product.condition || 'Unknown',
          quantity: product.quantity || 0,
          images: product.images || [],
          price: product.price || 0,
          discount: product.discount || 0,
          isApproved: product.isApproved || false,
          seller: product.seller ? product.seller.toString() : 'Unknown Seller',
          createdAt: product.createdAt || new Date(),
          updatedAt: product.updatedAt || new Date(),
        };

        let categorySpecificFields = {};
        switch (product.categoryType) {
          case 'Sculpture':
            categorySpecificFields = {
              height: product.height,
              width: product.width,
              technique: product.technique,
            };
            break;
          case 'Textiles':
            categorySpecificFields = {
              fabricType: product.fabricType,
              pattern: product.pattern,
              length: product.length,
              width: product.width,
            };
            break;
          case 'Pottery':
            categorySpecificFields = {
              clayType: product.clayType,
              glaze: product.glaze,
              height: product.height,
              diameter: product.diameter,
            };
            break;
          case 'Jewelry':
            categorySpecificFields = {
              stoneType: product.stoneType,
              metalType: product.metalType,
              length: product.length,
              diameter: product.diameter,
            };
            break;
          case 'Paintings':
            categorySpecificFields = {
              medium: product.medium,
              size: product.size,
              condition:product.condition
            };
            break;
          default:
            break;
        }

        return { ...baseFields, ...categorySpecificFields };
      });

      await index.saveObjects(records);

    } catch (error) {
      console.error('Failed to sync products with Algolia', error);
      throw new Error('Failed to sync products with Algolia');
    }
  },
};
