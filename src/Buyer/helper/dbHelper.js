const mongoose = require('mongoose');
const constants = require('../constants');


module.exports.formatMongoData = (data) => {
  if (Array.isArray(data)) {
    return data.map(item => {
      const formattedItem = item.toObject();
      delete formattedItem.refreshToken; 
      return formattedItem;
    });
  } else {
    const formattedData = data.toObject();
    delete formattedData.refreshToken; 
    return formattedData;
  }
};


module.exports.checkObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(constants.databaseMessage.INVALID_ID);
  }
}






