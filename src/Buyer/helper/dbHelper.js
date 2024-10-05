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






