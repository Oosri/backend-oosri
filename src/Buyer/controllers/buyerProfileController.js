const buyerProfileService = require('../Service/buyerProfileService');
const constants = require('../constants');
const upload = require('../middlewares/fileUploadMiddleware');


module.exports.updateBuyerProfile = async (req, res) => {
    let response = { ...constants.customServerResponse };
    try {
      const serviceResponse = await buyerProfileService.updateBuyerProfile({ 
        buyerId: req.user.id, 
        updateData: req.body});
      response.status = 200;
      response.message = constants.buyerProfileMessage.USERPROFILE_UPDATED;
      response.body = serviceResponse;
    } catch (error) {
      console.log('Something went wrong: Controller: updateBuyerProfile', error);
      response.message = error.message;
      return res.status(400).send(response);
    }
    return res.status(response.status).send(response);
  };


  

  module.exports.changePassword = async (req, res) => {
    const response = { ...constants.customServerResponse };
    try {
      const { oldPassword, newPassword } = req.body;
  
      const serviceResponse = await buyerProfileService.changeBuyerPassword({
        buyerId: req.user.id, 
        oldPassword,
        newPassword
      });
    
  
      response.status = 200;
      response.message = constants.buyerProfileMessage.PASSWORD_CHANGED_SUCCESSFULLY;
      response.body = serviceResponse;
    } catch (error) {
      console.log('Something went wrong: Controller: changePassword', error);
      response.message = error.message;
    }
    return res.status(response.status).send(response);
  };
  

  


  exports.uploadBuyerProfileImage = async (req, res) => {
    const response = { ...constants.customServerResponse };
  
    try {
      const fileBuffer = req.file.buffer; 
      const originalName = req.file.originalname;
      if(!fileBuffer){
        return res.status(400).json({ message: 'File is required' });
      }
  
      const serviceResponse = await buyerProfileService.uploadBuyerProfileImage({
        buyerId: req.user.id, 
        fileBuffer,
        originalName,
      });
  
      response.status = 200;
      response.message = constants.buyerProfileMessage.PROFILE_IMAGE_UPLOAD;
      response.body = serviceResponse;
  
      return res.status(200).json(response);
    } catch (error) {
      console.error('Controller error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  };