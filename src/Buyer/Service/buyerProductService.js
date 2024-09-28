const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants')



  

  module.exports = {

    retrieveAllProducts : async ({ skip = 0, limit = 10, category, color, brand, productName, minPrice, maxPrice, country, storage }) => {
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
    
    retrieveProductById : async ({ id }) => {
      try {
        mongoDbDataFormat.checkObjectId(id)
        let product = await Product.findById(id);
        if (!product) {
          throw new Error(constants.productMessage.PRODUCT_NOT_FOUND);
        }
        return mongoDbDataFormat.formatMongoData(product);
      } catch (error) {
        console.log('Something went wrong: Service: retrieveProductById', error);
        throw new Error(error);
      }

    },

  };