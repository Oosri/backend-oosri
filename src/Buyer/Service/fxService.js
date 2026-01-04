const axios = require('axios');

/**
 * Configuration
 */
const FX_API_URL = process.env.FX_API_URL
  ?? 'https://openexchangerates.org/api/latest.json';

const FX_API_KEY = process.env.FX_API_KEY;
const FX_TTL_MS = Number(process.env.FX_TTL_MS ?? 10 * 60 * 1000); // 10 minutes
const FX_TIMEOUT_MS = Number(process.env.FX_TIMEOUT_MS ?? 110000);
const FX_SPREAD_PERCENT = parseFloat(process.env.FX_SPREAD_PERCENT ?? '1'); // 1% default spread

/**
 * In-memory cache
 */
const FX_CACHE = {
  rate: null,        // NGN -> USD (with spread)
  expiresAt: 0
};

/**
 * In-flight request lock (prevents cache stampede)
 */
let inflightPromise = null;

/**
 * Fetch FX rate from provider (OpenExchangeRates)
 * Returns: NGN -> USD rate (MID-MARKET)
 */
async function fetchRateFromProvider() {
  if (!FX_API_KEY) {
    throw new Error('FX_API_KEY is not configured');
  }

  try {
    const response = await axios.get(FX_API_URL, {
      params: {
        app_id: FX_API_KEY,
        symbols: 'NGN'
      },
      timeout: FX_TIMEOUT_MS
    });

    const usdToNgn = response?.data?.rates?.NGN;

    if (typeof usdToNgn !== 'number' || usdToNgn <= 0) {
      throw new Error('Invalid NGN rate returned by FX provider');
    }

    // Convert USD -> NGN  =>  NGN -> USD
    return 1 / usdToNgn;
  } catch (error) {
    throw new Error(`FX provider error: ${error.message}`);
  }
}

/**
 * Get cached FX rate (NGN -> USD)
 * Includes a spread to cover conversion fees and volatility.
 */
async function getFxRateNGNtoUSD() {
  const now = Date.now();

  // 1. Return fresh cached value
  if (FX_CACHE.rate && FX_CACHE.expiresAt > now) {
    return FX_CACHE.rate;
  }

  // 2. If a fetch is already in progress, wait for it
  if (inflightPromise) {
    return inflightPromise;
  }

  // 3. Fetch new rate with locking
  inflightPromise = (async () => {
    try {
      const midMarketRate = await fetchRateFromProvider();

      // Apply spread (e.g., 1% spread means rate is 1% higher for the buyer)
      // If 1 USD = 1500 NGN (mid-market), NGN -> USD is 1/1500 = 0.000666...
      // With 1% spread, buyer pays 1% more USD: 0.000666 * 1.01 = 0.000673...
      const rateWithSpread = midMarketRate * (1 + (FX_SPREAD_PERCENT / 100));

      FX_CACHE.rate = rateWithSpread;
      FX_CACHE.expiresAt = Date.now() + FX_TTL_MS;

      return rateWithSpread;
    } catch (error) {
      // 4. Fallback to stale cache if available
      if (FX_CACHE.rate) {
        console.warn(
          '[FX] Provider failed, using stale FX rate:',
          error.message
        );
        return FX_CACHE.rate;
      }

      throw error;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

/**
 * Convert NGN amount to USD
 * @param {number} amountNGN - Amount in NGN
 * @param {number} rate - NGN -> USD rate (optional, will fetch if not provided)
 * @returns {number} - Amount in USD (high precision)
 */
async function convertNGNtoUSD(amountNGN, rate = null) {
  const fxRate = rate || await getFxRateNGNtoUSD();
  return amountNGN * fxRate;
}

module.exports = {
  getFxRateNGNtoUSD,
  convertNGNtoUSD
};
