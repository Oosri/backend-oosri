const axios = require('axios');
const redis = require('../../configs/redis');

/**
 * Configuration
 */
const FX_API_URL = process.env.FX_API_URL
  ?? 'https://openexchangerates.org/api/latest.json';

const FX_API_KEY = process.env.FX_API_KEY;
const FX_TTL_MS = Number(process.env.FX_TTL_MS ?? 10 * 60 * 1000); // 10 minutes
const FX_TIMEOUT_MS = Number(process.env.FX_TIMEOUT_MS ?? 10000); // Increased from 5s to 10s
const FX_SPREAD_PERCENT = parseFloat(process.env.FX_SPREAD_PERCENT ?? '1'); // 1% default spread

const FX_CACHE = {
  rate: null,
  expiresAt: 0
};

const STALE_TTL_MS = 30 * 1000; // 30 seconds tolerance for background fetch
const HARD_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours fallback safety

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



async function getFxRateNGNtoUSD() {
  const cacheKey = 'fx_rate_ngn_usd_v2';

  // 1. Try to get from Redis
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const { rate, expiresAt } = JSON.parse(cached);

      // If still valid, return immediately
      if (Date.now() < expiresAt) {
        return rate;
      }

      // If stale, return stale rate and trigger background revalidation
      // (only if no fetch is currently in flight)
      if (!inflightPromise) {
        console.log('[FX] Serving stale rate, revalidating in background...');
        revalidateRate(cacheKey).catch(err => console.error('[FX] Background revalidation failed:', err.message));
      }
      return rate;
    }
  } catch (redisError) {
    console.error('[FX] Redis error:', redisError.message);
  }

  // 2. No cache or Redis failure: wait for revalidation
  return revalidateRate(cacheKey);
}

/**
 * Revalidates the FX rate and updates Redis
 */
async function revalidateRate(cacheKey) {
  if (inflightPromise) return inflightPromise;

  const permanentKey = `${cacheKey}_permanent`;

  inflightPromise = (async () => {
    try {
      const midMarketRate = await fetchRateFromProvider();
      const rateWithSpread = midMarketRate * (1 + (FX_SPREAD_PERCENT / 100));

      const data = {
        rate: rateWithSpread,
        expiresAt: Date.now() + FX_TTL_MS
      };

      // Store in Redis with a long hard TTL (for SWR)
      // AND in a permanent key (no TTL) for disaster recovery
      try {
        await Promise.all([
          redis.set(cacheKey, JSON.stringify(data), 'PX', HARD_TTL_MS),
          redis.set(permanentKey, rateWithSpread.toString())
        ]);
        // Update in-memory fallback too
        FX_CACHE.rate = rateWithSpread;
      } catch (redisSetError) {
        console.error('[FX] Redis set error:', redisSetError.message);
      }

      return rateWithSpread;
    } catch (error) {
      console.error('[FX] Revalidation failed:', error.message);

      // FALLBACK STRATEGY:
      // 1. Try in-memory cache
      if (FX_CACHE.rate) {
        console.log('[FX] Using in-memory fallback rate');
        return FX_CACHE.rate;
      }

      // 2. Try permanent Redis key
      try {
        const permanentRate = await redis.get(permanentKey);
        if (permanentRate) {
          console.log('[FX] Using permanent Redis fallback rate');
          const rate = parseFloat(permanentRate);
          FX_CACHE.rate = rate; // Update in-memory
          return rate;
        }
      } catch (redisGetError) {
        console.error('[FX] Permanent rate recovery failed:', redisGetError.message);
      }

      // 3. Last resort: Hardcoded safe rate or throw
      const HARDCODED_SAFE_RATE = 1 / 1500; // 1500 NGN = 1 USD
      console.warn('[FX] Critical: All FX fallbacks failed. Using hardcoded safe rate.');
      return HARDCODED_SAFE_RATE;
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
