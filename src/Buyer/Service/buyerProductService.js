const Product = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const moment = require('moment');
const constants = require('../constants');
const algoliasearch = require('algoliasearch');

const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_SEARCH_API_KEY);

const index = client.initIndex(process.env.ALGOLIA_INDEX_NAME);


module.exports = {
    retrieveAllProducts: async ({
      skip = 0,
      limit = 10,
      category,
      productName,
      minPrice,
      maxPrice,
      country,
      artist,
      condition,
      isApproved,
    }) => {
      try {
        let query = {};
  
        // Building the query based on filters
        if (productName) {
          query.productName = { $regex: new RegExp(productName.trim(), 'i') };
        }
  
        if (category) {
          query.category = { $regex: new RegExp(category.trim(), 'i') };
        }
  
        if (country) {
          query.country = { $regex: new RegExp(country.trim(), 'i') };
        }
  
        if (artist) {
          query.artist = { $regex: new RegExp(artist.trim(), 'i') };
        }
  
        if (condition) {
          query.condition = { $regex: new RegExp(condition.trim(), 'i') };
        }
  
        if (isApproved !== undefined) {
          query.isApproved = isApproved;
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
  
        const totalProducts = await Product.countDocuments(query);
        const products = await Product.find(query)
          .skip(parseInt(skip))
          .limit(parseInt(limit));
  
        const formattedProducts = products.map((product) => ({
          productId: product._id,
          productName: product.productName,
          category: product.category,
          productDescription: product.productDescription,
          artist: product.artist,
          country: product.country,
          condition: product.condition,
          quantity: product.quantity,
          images: product.images,
          price: product.price,
          discount: product.discount,
          isApproved: product.isApproved,
          createdAt: moment(product.createdAt).format('YYYY-MM-DD hh:mm:ss A'),
          updatedAt: moment(product.updatedAt).format('YYYY-MM-DD hh:mm:ss A'),
        }));
  
        return {
          products: mongoDbDataFormat.formatMongoData(formattedProducts),
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
    
          const formattedProduct = {
            productId: product._id,
            productName: product.productName,
            category: product.category,
            productDescription: product.productDescription,
            artist: product.artist,
            country: product.country,
            condition: product.condition,
            quantity: product.quantity,
            images: product.images,
            price: product.price,
            discount: product.discount || 0, 
            isApproved: product.isApproved,
            sellerName: sellerName,
            createdAt: moment(product.createdAt).format('YYYY-MM-DD hh:mm:ss A'),
            updatedAt: moment(product.updatedAt).format('YYYY-MM-DD hh:mm:ss A'),
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
    
            const formattedProducts = await Promise.all(result.hits.map(async (product) => {
                const sellerDetails = await mongoDbDataFormat.getSellerDetails(product.seller);
                console.log('sellerDetails', sellerDetails);
            
                const sellerName = sellerDetails 
                    ? `${sellerDetails.firstName} ${sellerDetails.lastName}` 
                    : 'Unknown Seller';  
            
                return {
                    productId: product.objectID,
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
                    sellerName: sellerName,  
                    createdAt: moment(product.createdAt).format('YYYY-MM-DD hh:mm:ss A'),
                    updatedAt: moment(product.updatedAt).format('YYYY-MM-DD hh:mm:ss A'),
                };
            }));
            
            return {
                products: mongoDbDataFormat.formatMongoData(formattedProducts),
                total: result.nbHits,
                currentPage: Math.floor(parseInt(skip) / parseInt(limit)) + 1,
                totalPages: Math.ceil(result.nbHits / parseInt(limit)),
            };
            
        } catch (error) {
            console.log('Something went wrong: searchProducts', error);
            throw new Error('Search failed');
        }
    },
    
    
  

      syncProductsToAlgolia: async () => {
        try {
          const products = await Product.find().lean();
          // const products = await Product.find({ isApproved: true }).lean();
      
          if (!products || products.length === 0) {
            throw new Error('No products found to sync.');
          }
      
          const records = products.map(product => ({
            objectID: product._id.toString(),
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
          }));
      
          console.log('Records to sync with Algolia:', records);
      
          const { taskID } = await index.saveObjects(records);
          console.log(`Products synced to Algolia with task ID: ${taskID}`);
        } catch (error) {
          console.error('Error syncing products to Algolia:', error);
        }
      }
      
  };
