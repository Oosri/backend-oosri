const constants = require('../constants');
const adminAuthService = require('../services/adminAuthService');
const mongoDbDataFormat = require('../helper/dbHelper');


module.exports.createAdmin = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const serviceResponse = await adminAuthService.createAdmin(req.body);
    response.status = 200;
    response.message = constants.adminAuthMessage.SIGNUP_SUCCESS;
    response.body = serviceResponse;
  } catch (error) {
    console.error('Something went wrong: Controller: createAdmin', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
}


module.exports.resendOtp = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const token = await adminAuthService.resendOtp(req.body.email);
    response.status = 200;
    response.message =constants.adminAuthMessage.TOKEN_SENT;
    response.body = { token }; 
  } catch (error) {
      console.error('Something went wrong: Controller: resendOtp', error);
     response.message = error.message;
  }
  return res.status(response.status).send(response);
};


module.exports.adminLogin = async (req, res) => {
  let response = { ...constants.customServerResponse };
  
  try {
    const serviceResponse = await adminAuthService.adminLogin(req.body);
    response.status = 200;
    response.message = constants.adminAuthMessage.LOGIN_SUCCESS;
    
  } catch (error) {
    console.error('Something went wrong: Controller: adminLogin', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};



module.exports.verifyLogin2FA = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { email, otp } = req.body;
 
    const serviceResponse = await adminAuthService.verifyLogin2FA(email, otp);
   
    response.status = 200;
    response.message = constants.adminAuthMessage.LOGIN_SUCCESS;
    response.body = serviceResponse;
  } catch (error) {
    console.error('Something went wrong: Controller: confirmOtp', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.refreshToken = async (req, res) => {
  let response = { ...constants.customServerResponse };
  
  try {
    const { refreshToken } = req.body;

    const serviceResponse = await adminAuthService.refreshToken(refreshToken);

    response.status = 200;
    response.message = constants.adminAuthMessage.REFRESH_TOKEN_SUCCESS;
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
      const token = await adminAuthService.requestResetPassword(req.body.email);
      response.status = 200;
      response.message =constants.adminAuthMessage.TOKEN_SENT;
      response.body = { token }; 
    } catch (error) {
        console.error('Something went wrong: Controller: requestResetPassword', error);
       response.message = error.message;
    }
    return res.status(response.status).send(response);
  };



  module.exports.validateResetToken =  async (req, res) => {
    let response = { ...constants.customServerResponse };
    try {
      const { email, otp } = req.body;
      const serviceResponse = await adminAuthService.validateResetPasswordToken(email, otp);
      response.status = 200;
      response.message =constants.adminAuthMessage.VALID_TOKEN;
  
    } catch (error) {
      console.error(`Error in validateResetToken: ${error.message}`);
      response.message = error.message;
    }
    return res.status(response.status).send(response);
  };

  
  module.exports.confirmResetPassword = async (req, res) => {
    let response = { ...constants.customServerResponse };
    try {
        const { email, otp, newPassword, confirmPassword } = req.body;
 
        await adminAuthService.confirmResetPassword(email, otp, newPassword, confirmPassword);

        response.status = 200;
        response.message = constants.adminAuthMessage.RESET_NEW_PASSWORD;
    } catch (error) {
        console.error('Something went wrong: Controller: confirmResetPassword', error);
        response.message = error.message;
    }
    return res.status(response.status).send(response);
};



module.exports.getCurrentUser = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const token = req.headers.authorization?.split(' ')[1];

    const serviceResponse = await adminAuthService.getCurrentUser(token);
    if (serviceResponse.user && serviceResponse.user.lastLogin) {
      serviceResponse.user.lastLogin = mongoDbDataFormat.formatCurrentDate(serviceResponse.user.lastLogin);
    }
    response.status = 200;
    response.message = constants.adminAuthMessage.USER_FETCH_SUCCESS;
    response.body = serviceResponse;
    
  } catch (error) {
    console.error('Something went wrong: Controller: getCurrentUser', error);
    response.message = error.message;
  }

  return res.status(response.status).send(response);
};
