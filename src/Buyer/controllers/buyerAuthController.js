const constants = require('../constants');
const buyerAuthService = require('../Service/buyerAuthService');


module.exports.registerBuyer = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const serviceResponse = await buyerAuthService.registerBuyer(req.body);
    response.status = 200;
    response.message = constants.buyerAuthMessage.SIGNUP_SUCCESS;
    response.body = serviceResponse;
  } catch (error) {
    console.log('Something went wrong: Controller: signup', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
}


module.exports.resendOtp = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const token = await buyerAuthService.resendOtp(req.body.email);
    response.status = 200;
    response.message =constants.buyerAuthMessage.TOKEN_SENT;
    response.body = { token }; 
  } catch (error) {
      console.log('Something went wrong: Controller: resendOtp', error);
     response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.confirmOtp = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { email, otp } = req.body;

    const serviceResponse = await buyerAuthService.confirmOtp(email, otp);
    
    response.status = 200;
    response.message = constants.buyerAuthMessage.CONFIRM_TOKEN_SUCCESS;
    response.body = serviceResponse;
  } catch (error) {
    console.log('Something went wrong: Controller: confirmOtp', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};



module.exports.buyerLogin = async (req, res) => {
  let response = { ...constants.customServerResponse };
  
  try {
    const serviceResponse = await buyerAuthService.buyerLogin(req.body);
    response.status = 200;
    response.message = constants.buyerAuthMessage.LOGIN_SUCCESS;
    response.body = serviceResponse;
    
  } catch (error) {
    console.error('Something went wrong: Controller: buyerLogin', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};




module.exports.refreshToken = async (req, res) => {
  let response = { ...constants.customServerResponse };
  
  try {
    const { refreshToken } = req.body;

    const serviceResponse = await buyerAuthService.refreshToken(refreshToken);

    response.status = 200;
    response.message = constants.buyerAuthMessage.REFRESH_TOKEN_SUCCESS;
    response.body = serviceResponse;

  } catch (error) {
    console.error('Something went wrong: Controller: refreshToken', error);
    response.status = 500;
    response.message = error.message || constants.serverError.INTERNAL_SERVER_ERROR;
  }

  return res.status(response.status).send(response);
};




module.exports.requestResetPassword = async (req, res) => {
    let response = { ...constants.customServerResponse };
    try {
      const token = await buyerAuthService.requestResetPassword(req.body.email);
      response.status = 200;
      response.message =constants.buyerAuthMessage.TOKEN_SENT;
      response.body = { token }; 
    } catch (error) {
        console.log('Something went wrong: Controller: requestResetPassword', error);
       response.message = error.message;
    }
    return res.status(response.status).send(response);
  };

  
  module.exports.confirmResetPassword = async (req, res) => {
    let response = { ...constants.customServerResponse };
    try {
        const { email, otp, newPassword, confirmPassword } = req.body;
 
        await buyerAuthService.confirmResetPassword(email, otp, newPassword, confirmPassword);

        response.status = 200;
        response.message = constants.buyerAuthMessage.RESET_NEW_PASSWORD;
    } catch (error) {
        console.log('Something went wrong: Controller: confirmResetPassword', error);
        response.message = error.message;
    }
    return res.status(response.status).send(response);
};
