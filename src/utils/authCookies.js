const isProduction = process.env.NODE_ENV === 'production';

const ACCESS_COOKIE = 'buyer_access_token';
const REFRESH_COOKIE = 'buyer_refresh_token';
const SESSION_COOKIE = 'buyer_session';
const VALID_SAME_SITE_VALUES = new Set(['lax', 'strict', 'none']);

const getCookieDomain = () => process.env.COOKIE_DOMAIN || undefined;

const getCookieSameSite = () => {
  const configuredSameSite = process.env.BUYER_AUTH_COOKIE_SAME_SITE;

  if (configuredSameSite) {
    const normalized = configuredSameSite.trim().toLowerCase();
    if (VALID_SAME_SITE_VALUES.has(normalized)) {
      return normalized;
    }
  }

  // Development runs on localhost:3000 -> localhost:3001, so lax is fine.
  // Staging/production are cross-site in this app, so we default to None.
  return isProduction ? 'none' : 'lax';
};

const getCookieSecure = () => {
  const configuredSecure = process.env.BUYER_AUTH_COOKIE_SECURE;

  if (configuredSecure === 'true') {
    return true;
  }

  if (configuredSecure === 'false') {
    return false;
  }

  return getCookieSameSite() === 'none' ? true : isProduction;
};

const getBaseCookieOptions = () => ({
  httpOnly: true,
  sameSite: getCookieSameSite(),
  secure: getCookieSecure(),
  domain: getCookieDomain(),
  path: '/',
});

const setBuyerAuthCookies = (res, { accessToken, refreshToken }) => {
  if (accessToken) {
    res.cookie(ACCESS_COOKIE, accessToken, {
      ...getBaseCookieOptions(),
      maxAge: 3 * 24 * 60 * 60 * 1000,
    });
  }

  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...getBaseCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
};

const clearBuyerAuthCookies = (res) => {
  const clearOptions = {
    domain: getCookieDomain(),
    path: '/',
  };

  res.clearCookie(ACCESS_COOKIE, clearOptions);
  res.clearCookie(REFRESH_COOKIE, clearOptions);
  res.clearCookie(SESSION_COOKIE, clearOptions);
};

const getBuyerAccessToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return req.cookies?.[ACCESS_COOKIE] || null;
};

const getBuyerRefreshToken = (req) => {
  if (req.body?.refreshToken) {
    return req.body.refreshToken;
  }

  return req.cookies?.[REFRESH_COOKIE] || null;
};

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  setBuyerAuthCookies,
  clearBuyerAuthCookies,
  getBuyerAccessToken,
  getBuyerRefreshToken,
};
