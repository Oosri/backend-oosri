const constants = require('../constants');
const buyerAuthService = require('../Service/buyerAuthService');
const mongoDbDataFormat = require('../helper/dbHelper');
const {
  clearBuyerAuthCookies,
  getBuyerAccessToken,
  getBuyerRefreshToken,
  setBuyerAuthCookies,
} = require('../../utils/authCookies');


module.exports.registerBuyer = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const serviceResponse = await buyerAuthService.registerBuyer(req.body);
    response.status = 200;
    response.message = constants.buyerAuthMessage.SIGNUP_SUCCESS;
    response.body = serviceResponse;
  } catch (error) {
    console.error('Something went wrong: Controller: signup', error);
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
      console.error('Something went wrong: Controller: resendOtp', error);
     response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.confirmOtp = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const { email, otp } = req.body;

    const serviceResponse = await buyerAuthService.confirmOtp(email, otp);
    setBuyerAuthCookies(res, serviceResponse);

    response.status = 200;
    response.message = constants.buyerAuthMessage.CONFIRM_TOKEN_SUCCESS;
    response.body = {
      user: serviceResponse.user,
      accessToken: serviceResponse.accessToken,
      refreshToken: serviceResponse.refreshToken,
    };
  } catch (error) {
    console.error('Something went wrong: Controller: confirmOtp', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};



module.exports.buyerLogin = async (req, res) => {
  let response = { ...constants.customServerResponse };
  
  try {
    const serviceResponse = await buyerAuthService.buyerLogin(req.body);
    setBuyerAuthCookies(res, serviceResponse);
    response.status = 200;
    response.message = constants.buyerAuthMessage.LOGIN_SUCCESS;
    response.body = {
      user: serviceResponse.user,
      accessToken: serviceResponse.accessToken,
      refreshToken: serviceResponse.refreshToken,
    };

  } catch (error) {
    console.error('Something went wrong: Controller: buyerLogin', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};





module.exports.refreshToken = async (req, res) => {
  let response = { ...constants.customServerResponse };
  
  try {
    const refreshToken = getBuyerRefreshToken(req);

    const serviceResponse = await buyerAuthService.refreshToken(refreshToken);
    setBuyerAuthCookies(res, serviceResponse);

    response.status = 200;
    response.message = constants.buyerAuthMessage.REFRESH_TOKEN_SUCCESS;
    response.body = {
      accessToken: serviceResponse.accessToken,
      refreshToken: serviceResponse.refreshToken,
    };

  } catch (error) {
    console.error('Something went wrong: Controller: refreshToken', error);
    clearBuyerAuthCookies(res);
    response.status = 401;
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
        console.error('Something went wrong: Controller: requestResetPassword', error);
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
        console.error('Something went wrong: Controller: confirmResetPassword', error);
        response.message = error.message;
    }
    return res.status(response.status).send(response);
};



module.exports.getCurrentUser = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const token = getBuyerAccessToken(req);

    const serviceResponse = await buyerAuthService.getCurrentUser(token);
    if (serviceResponse.user && serviceResponse.user.lastLogin) {
      serviceResponse.user.lastLogin = mongoDbDataFormat.formatCurrentDate(serviceResponse.user.lastLogin);
    }
    response.status = 200;
    response.message = constants.buyerAuthMessage.USER_FETCH_SUCCESS;
    response.body = serviceResponse;
    
  } catch (error) {
    console.error('Something went wrong: Controller: getCurrentUser', error);
    response.message = error.message;
  }

  return res.status(response.status).send(response);
};
module.exports.googleLogin = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    const serviceResponse = await buyerAuthService.googleLogin(req.body);
    setBuyerAuthCookies(res, serviceResponse);
    response.status = 200;
    response.message = constants.buyerAuthMessage.LOGIN_SUCCESS;
    response.body = {
      user: serviceResponse.user,
      accessToken: serviceResponse.accessToken,
      refreshToken: serviceResponse.refreshToken,
    };

  } catch (error) {
    console.error('Something went wrong: Controller: googleLogin', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.googleUserInfo = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const userInfo = await buyerAuthService.googleUserInfo(req.body);
    response.status = 200;
    response.message = 'User info fetched';
    response.body = userInfo;
  } catch (error) {
    console.error('Something went wrong: Controller: googleUserInfo', error);
    response.message = error.message;
  }
  return res.status(response.status).send(response);
};

module.exports.logout = async (req, res) => {
  let response = { ...constants.customServerResponse };

  try {
    if (req.user?.id) {
      await buyerAuthService.logout(req.user.id);
    }

    clearBuyerAuthCookies(res);
    response.status = 200;
    response.message = 'Logout Success';
    response.body = {};
  } catch (error) {
    clearBuyerAuthCookies(res);
    response.status = 200;
    response.message = 'Logout Success';
    response.body = {};
  }

  return res.status(response.status).send(response);
};
