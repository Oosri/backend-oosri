const buyerProfileService = require('../Service/buyerProfileService');
const constants = require('../constants');

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
  

  
module.exports.uploadBuyerProfileImage = (req, res) => {
    const response = { ...constants.customServerResponse };
    upload.single('profileImage')(req, res, async (error) => {
      if (error) {
        console.log('Something went wrong: Controller: uploadBuyerProfileImage', error);
        response.message = error.message;
        return res.status(400).json(response);
      }
  
      try {
        const userId = req.user.id;
        const imagePath = req.file.path;
        const serviceResponse = await buyerProfileService.uploadBuyerProfileImage(userId, imagePath);
        response.status = 200;
        response.message = constants.buyerProfileMessage.PROFILE_IMAGE_UPLOAD;
        response.body = serviceResponse;
      } catch (error) {
        console.log('Something went wrong: Controller: uploadBuyerProfileImage', error);
        response.message = error.message;
      }
      return res.status(response.status).json(response);
    });
  };
  
  