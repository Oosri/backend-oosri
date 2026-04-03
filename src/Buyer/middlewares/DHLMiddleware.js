const buyerDHLService = require('../Service/buyerDHLService');

let accessToken = null;
let refreshToken = null;
let accessTokenExpiration = null;

const tokenMiddleware = async (req, res, next) => {
  const currentTime = Math.floor(Date.now() / 1000);

  try {
    if (!accessToken || currentTime >= accessTokenExpiration) {
      if (refreshToken && currentTime < accessTokenExpiration + 3600) {
        const tokenData = await buyerDHLService.refreshAccessToken(refreshToken);
        accessToken = tokenData.accessToken;
        refreshToken = tokenData.refreshToken;
        accessTokenExpiration = tokenData.accessTokenExpiration;
      } else {
        const tokenData = await buyerDHLService.getAccessToken();
        accessToken = tokenData.accessToken;
        refreshToken = tokenData.refreshToken;
        accessTokenExpiration = tokenData.accessTokenExpiration;
      }
    }

    req.accessToken = accessToken;
    next();
  } catch (error) {
    console.error('Token middleware error:', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = tokenMiddleware;