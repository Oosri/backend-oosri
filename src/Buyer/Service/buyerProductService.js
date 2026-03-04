const { Product, Sculpture, Textiles, Pottery, Jewelry, Paintings } = require('../../models/productModel');
const { Category, SubCategory } = require('../../models/categoryModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const moment = require('moment');
const constants = require('../constants');
const algoliasearch = require('algoliasearch');
const buyerProductReview = require('../../Buyer/models/buyerProductReviewModel');
const mongoose = require('mongoose');
const { number } = require('@hapi/joi');
const buyerSavedItems = require('../../Buyer/models/buyerSavedItemsModel');
const { isIn } = require('validator');


const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_SEARCH_API_KEY);

const index = client.initIndex(process.env.ALGOLIA_INDEX_NAME);

// Import FX service for USD price conversion
const { getFxRateNGNtoUSD } = require('../Service/adminControlledFxService');

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
    salesPriceUSD: convertToUSD(product.salesPrice),
    previousPriceUSD: convertToUSD(product.previousPrice),
    fxRate: fxRate,
  };
}


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
      // Fetch FX rate for USD conversion
      let fxRate = null;
      try {
        fxRate = await getFxRateNGNtoUSD();
      } catch (fxError) {
        console.warn('Failed to fetch FX rate for USD conversion:', fxError.message);
        // Continue without USD prices if FX rate fetch fails
      }

      let query = { isVisible: true };

      if (productName) {
        query.productName = { $regex: new RegExp(productName.trim(), 'i') };
      }

      // Lookup categories by name and filter by ObjectIds
      if (category) {
        const categoryNames = Array.isArray(category) ? category : [category];
        const categories = await Category.find({
          name: { $in: categoryNames.map(c => new RegExp(c.trim(), 'i')) }
        }).select('_id');
        const categoryIds = categories.map(cat => cat._id);
        if (categoryIds.length > 0) {
          query.category = { $in: categoryIds };
        }
      }

      // Lookup subcategories by name and filter by ObjectIds
      if (subCategory) {
        const subCategoryNames = Array.isArray(subCategory) ? subCategory : [subCategory];
        const subCategories = await SubCategory.find({
          name: { $in: subCategoryNames.map(s => new RegExp(s.trim(), 'i')) }
        }).select('_id');
        const subCategoryIds = subCategories.map(sub => sub._id);
        if (subCategoryIds.length > 0) {
          query.subcategory = { $in: subCategoryIds };
        }
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
        .populate('category', 'name')
        .populate('subcategory', 'name')
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

          const productData = {
            _id: product._id,
            productName: product.productName,
            productPrice: product.regularPrice,
            regularPrice: product.regularPrice,
            salesPrice: product.salesPrice || product.regularPrice,
            previousPrice: product.previousPrice,
            productCategory: product.category?.name || null,
            productSubcategory: product.subcategory?.name || null,
            sellerName: sellerName,
            productRating: productRating,
            productImages: product.images || [],
          };

          // Add USD prices if FX rate is available
          return addUSDPrices(productData, fxRate);
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
      // Fetch FX rate for USD conversion
      let fxRate = null;
      try {
        fxRate = await getFxRateNGNtoUSD();
      } catch (fxError) {
        console.warn('Failed to fetch FX rate for USD conversion:', fxError.message);
        // Continue without USD prices if FX rate fetch fails
      }

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

      const productReviews = await buyerProductReview
        .find({ productId: product._id })
        .sort({ createdAt: -1 })
        .limit(5);

      const reviews = productReviews.map((review) => ({
        _id: review._id,
        review: review.review,
        reviewer: review.reviewer,
        productRating: review.productRating,
        reviewerImage: review.reviewerImage || '',
        reviewDate: moment(review.createdAt).format('YYYY-MM-DD hh:mm:ss A'),
      }));

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


      const baseFields = {
        _id: product._id,
        productId: product.productId,
        productName: product.productName,
        category: product.category,
        productDescription: product.productDescription,
        artist: product.brandArtist,
        country: product.country || 'N/A',
        condition: product.condition || 'N/A',
        quantity: product.quantity || 0,
        productImages: product.images,
        regularPrice: product.regularPrice,
        previousPrice: previousPrice,
        salesPrice: product.salesPrice || product.regularPrice,
        discount: product.discount || 0,
        discountOff: discountOff.toFixed(2),
        isApproved: product.isApproved,
        sellerName: sellerName,
        productRating: productRating,
        productReviews: reviews || [],
        numberOfReviews: productReviews.length || 0,
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

      // Add USD prices to main product
      const productWithUSD = addUSDPrices(formattedProduct, fxRate);

      const relatedRawProducts = await Product.find({
        _id: { $ne: product._id },
        category: product.category,
        isVisible: true,
      }).limit(8);

      const relatedProducts = await Promise.all(
        relatedRawProducts.map(async (relatedProduct) => {
          const sellerDetails = await mongoDbDataFormat.getSellerDetails(relatedProduct.seller);
          const sellerName = sellerDetails
            ? `${sellerDetails.firstName} ${sellerDetails.lastName}`
            : 'Unknown Seller';

          const productReviews = await buyerProductReview.find({
            productId: relatedProduct._id,
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

          const relatedProductData = {
            _id: relatedProduct._id,
            productName: relatedProduct.productName,
            productPrice: relatedProduct.regularPrice,
            regularPrice: relatedProduct.regularPrice,
            salesPrice: relatedProduct.salesPrice || relatedProduct.regularPrice,
            previousPrice: relatedProduct.previousPrice,
            productCategory: relatedProduct.category,
            sellerName: sellerName,
            productRating: productRating,
            productImages: relatedProduct.images || [],
          };

          // Add USD prices to related products
          return addUSDPrices(relatedProductData, fxRate);
        })
      );

      return {
        product: mongoDbDataFormat.formatMongoData(productWithUSD),
        relatedProducts,
      };
    } catch (error) {
      console.error('Something went wrong: Service: retrieveProductById', error);
      throw new Error('Failed to retrieve product');
    }
  },


  searchProducts: async (searchTerm, filters = null, skip = 0, limit = 10) => {
    try {
      // Fetch FX rate for USD conversion
      let fxRate = null;
      try {
        fxRate = await getFxRateNGNtoUSD();
      } catch (fxError) {
        console.warn('Failed to fetch FX rate for USD conversion:', fxError.message);
        // Continue without USD prices if FX rate fetch fails
      }

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
            _id: product.objectID,
            product: product.productId,
            productName: product.productName,
            category: product.category || 'Miscellaneous',
            productDescription: product.productDescription || 'No description available',
            artist: product.artist || 'Unknown Artist',
            country: product.country || 'Unknown',
            condition: product.condition || 'Unknown',
            quantity: product.quantity || 0,
            productImages: product.images || [],
            price: product.price || 0,
            regularPrice: product.regularPrice || 0,
            salesPrice: product.salesPrice || product.regularPrice || 0,
            previousPrice: product.previousPrice || null,
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

          const productData = {
            ...baseFields,
            ...categorySpecificFields
          };

          // Add USD prices to search results
          return addUSDPrices(productData, fxRate);
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



  syncProductsToAlgolia: async (productData) => {
    try {
      let products;
      if (productData) {
        // Handle single product or array
        products = Array.isArray(productData) ? productData : [productData];
      } else {
        console.warn('⚠️ FULL Algolia sync triggered. This is expensive and should be avoided in production.');
        products = await Product.find().lean();
      }

      if (!products || products.length === 0) {
        return;
      }

      const records = products.map((product) => {
        // Ensure we have a plain object
        const p = product.toObject ? product.toObject() : product;

        const baseFields = {
          objectID: p._id.toString(),
          product: p.productId,
          productName: p.productName,
          category: p.category || 'Miscellaneous',
          productDescription: p.productDescription || 'No description available',
          artist: p.brandArtist || p.artist || 'Unknown Artist',
          country: p.country || 'Unknown',
          condition: p.condition || 'Unknown',
          quantity: p.quantity || 0,
          images: p.images || [],
          price: p.regularPrice || p.price || 0,
          regularPrice: p.regularPrice || 0,
          salesPrice: p.salesPrice || p.regularPrice || 0,
          discount: p.discount || 0,
          isApproved: p.isApproved || false,
          seller: p.seller ? p.seller.toString() : 'Unknown Seller',
          createdAt: p.createdAt || new Date(),
          updatedAt: p.updatedAt || new Date(),
        };

        let categorySpecificFields = {};
        // Use category name if it's populated, otherwise check categoryType or category string
        const categoryName = p.category?.name || p.category;

        switch (categoryName) {
          case 'Sculpture':
            categorySpecificFields = {
              height: p.height,
              width: p.width,
              technique: p.technique,
            };
            break;
          case 'Textiles':
            categorySpecificFields = {
              fabricType: p.fabricType,
              pattern: p.pattern,
              length: p.length,
              width: p.width,
            };
            break;
          case 'Pottery':
            categorySpecificFields = {
              clayType: p.clayType,
              glaze: p.glaze,
              height: p.height,
              diameter: p.diameter,
            };
            break;
          case 'Jewelry':
            categorySpecificFields = {
              stoneType: p.stoneType,
              metalType: p.metalType,
              length: p.length,
              diameter: p.diameter,
            };
            break;
          case 'Paintings':
            categorySpecificFields = {
              medium: p.medium,
              size: p.size,
              condition: p.condition
            };
            break;
          default:
            break;
        }

        return { ...baseFields, ...categorySpecificFields };
      });

      await index.saveObjects(records);
      console.log(`✅ Algolia sync successful for ${records.length} product(s)`);

    } catch (error) {
      console.error('Failed to sync products with Algolia', error);
      // Don't throw - search sync shouldn't break the main flow but should be logged
    }
  },

  removeProductFromAlgolia: async (productId) => {
    try {
      if (!productId) return;
      await index.deleteObject(productId.toString());
      console.log(`🗑️ Product ${productId} removed from Algolia`);
    } catch (error) {
      console.error('Failed to remove product from Algolia', error);
    }
  },
};
