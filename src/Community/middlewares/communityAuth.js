const { verifyJwt } = require('../../utils/jwt');
const { getBuyerAccessToken } = require('../../utils/authCookies');

const buyerAuth = (req, res, next) => {
  try {
    const token = getBuyerAccessToken(req);
    if (!token) throw new Error('TOKEN_MISSING');
    const decoded = verifyJwt(token);
    req.user = decoded;
    req.community = { actorId: decoded.id || decoded._id, actorType: 'buyer' };
    next();
  } catch {
    return res.status(401).json({ status: 401, success: false, message: 'Not authorised' });
  }
};

const sellerAuth = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 401, success: false, message: 'Not authorised' });
  }
  try {
    const decoded = verifyJwt(authHeader.split(' ')[1]);
    req.sellerId = decoded.sellerId;
    req.community = { actorId: decoded.sellerId, actorType: 'seller' };
    next();
  } catch {
    return res.status(401).json({ status: 401, success: false, message: 'Invalid token' });
  }
};

const optionalAuth = (req, res, next) => {
  const token = getBuyerAccessToken(req);
  if (token) {
    try {
      const decoded = verifyJwt(token);
      req.user = decoded;
      req.community = { actorId: decoded.id || decoded._id, actorType: 'buyer' };
    } catch {
      req.community = null;
    }
  }
  next();
};

module.exports = { buyerAuth, sellerAuth, optionalAuth };
