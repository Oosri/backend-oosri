const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const algoliasearch = require('algoliasearch');

const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_SEARCH_API_KEY);

const index = client.initIndex(process.env.ALGOLIA_INDEX_NAME);



module.exports = {

    retrieveAllProducts: async ({ skip = 0, limit = 10, category, color, brand, productName, minPrice, maxPrice, country, storage }) => {
        try {
            let query = {};

            if (productName) {
                query.productName = { $regex: new RegExp(productName.trim(), 'i') };
            }

            if (category) {
                query.category = { $regex: new RegExp(category.trim(), 'i') };
            }

            if (color) {
                query.color = { $regex: new RegExp(color.trim(), 'i') };
            }

            if (brand) {
                query.brand = { $regex: new RegExp(brand.trim(), 'i') };
            }

            if (country) {
                query.country = { $regex: new RegExp(country.trim(), 'i') };
            }

            if (minPrice || maxPrice) {
                query.price = {};
                if (minPrice) {
                    query.price.$gte = minPrice;
                }
                if (maxPrice) {
                    query.price.$lte = maxPrice;
                }
            }

            if (storage) {
                query.storage = storage;
            }

            let products = await Product.find(query)
                .skip(parseInt(skip))
                .limit(parseInt(limit));

            return mongoDbDataFormat.formatMongoData(products);
        } catch (error) {
            console.log('Something went wrong: Service: retrieveAllProducts', error);
            throw new Error(error);
        }
    },

    retrieveProductById: async ({ id }) => {
        try {
            mongoDbDataFormat.checkObjectId(id)
            let product = await Product.findById(id);
            if (!product) {
                throw new Error(constants.buyerProductMessage.PRODUCT_NOT_FOUND);
            }
            return mongoDbDataFormat.formatMongoData(product);
        } catch (error) {
            console.log('Something went wrong: Service: retrieveProductById', error);
            throw new Error(error);
        }
    },

    searchProducts: async (searchTerm, filters = null) => {
        try {

          
      if (!searchTerm) {
        throw new Error(constants.buyerProductMessage.SEARCH_TERM_REQUIRED);
      }
            const options = {};
            if (filters) {
                options.filters = filters;
            }

            const result = await index.search(searchTerm, options);
            return result.hits;
        } catch (error) {
            console.log('Something went wrong: searchProducts', error);
            throw new Error('Search failed');
        }
    },

    syncProductsToAlgolia: async () => {
      try {
          const products = await Product.find().lean();  
          //const products = await Product.find({ isApproved: true }).lean(); 

          if (!products || products.length === 0) {
              throw new Error('No products found to sync.');
          }

          const records = products.map(product => ({
              objectID: product._id.toString(),  
              productName: product.productName,
              productRating: product.productRating || 0,  
              color: product.color || 'N/A',  
              category: product.category || 'Miscellaneous',
              country: product.country || 'Unknown',
              condition: product.condition || 'Unknown',
              quantity: product.quantity || 0,
              images: product.images || [],  
              price: product.price || 0,
              productDescription: product.productDescription || 'No description available',
              seller: product.seller ? product.seller.toString() : 'Unknown Seller',
              createdAt: product.createdAt || new Date(),
              updatedAt: product.updatedAt || new Date(),
              brand: product.brand || 'Unknown',
              model: product.model ? product.model.trim() : 'Unknown',
              operatingSystem: product.operatingSystem || undefined,
              storage: product.storage || undefined,
              camera: product.camera || undefined,
              bandMaterial: product.bandMaterial || undefined
          }));

          console.log('Records to sync with Algolia:', records);

          const { taskID } = await index.saveObjects(records);
          console.log(`Products synced to Algolia with task ID: ${taskID}`);
      } catch (error) {
          console.error('Error syncing products to Algolia:', error);
      }
  }
  };
