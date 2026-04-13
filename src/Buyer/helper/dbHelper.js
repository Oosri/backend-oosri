const mongoose = require('mongoose');
const constants = require('../constants');
const { Product } = require('../../models/productModel');
const Buyer = require('../models/buyerAuthModel');
const Seller = require('../../models/sellerModel')
const crypto = require('crypto');

module.exports.formatMongoData = (data) => {
  if (Array.isArray(data)) {
      return data.map(item => {
          const formattedItem = item instanceof mongoose.Document ? item.toObject() : item;
          delete formattedItem.refreshToken; 
          delete formattedItem.refreshTokenHash;
          return formattedItem;
      });
  } else {
      const formattedData = data instanceof mongoose.Document ? data.toObject() : data;
      delete formattedData.refreshToken; 
      delete formattedData.refreshTokenHash;
      return formattedData;
  }
};

module.exports.getProductsBySeller = async (sellerId) => {
  const products = await Product.find({ seller: sellerId }).select('_id');
  return products.map(product => product._id);
};


  module.exports.getUserById = async (userId) => {
      return await Buyer.findById(userId); 
  }

  module.exports.getSellerDetails = async (sellerId) => {
    try {
        const seller = await Seller.findById(sellerId).select('firstName lastName');

        if (!seller) {
            return null; 
        }
        return seller;
    } catch (error) {
        return null; 
    }
};

module.exports.checkObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(constants.databaseMessage.INVALID_ID);
  }
}



module.exports.formatCurrentDate = () => {
  const currentDate = new Date();

  return currentDate.toLocaleString('en-US', {
    weekday: 'short',  
    day: 'numeric',    
    month: 'short',    
    year: 'numeric',  
    hour: 'numeric',   
    minute: 'numeric', 
    second: 'numeric',
    hour12: true       
  });
};


// module.exports.formatCurrentDate = () => {
//   const currentDate = new Date();

//   return currentDate.toLocaleDateString('en-US', {
//     weekday: 'short',  
//     day: 'numeric',    
//     year: 'numeric',   
//   });
// }


module.exports.formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0'); 
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};



