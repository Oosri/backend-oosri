const FxRate = require('../../models/fxRateModel');
const redis = require('../../configs/redis');

/**
 * adminControlledFxService.js
 *
 * Drop-in replacement for fxService.js.
 * Exports the IDENTICAL interface: { getFxRateNGNtoUSD, convertNGNtoUSD }
 *
 * Instead of calling an external API (OpenExchangeRates), this service reads
 * the exchange rate set by an admin via the /admin/fx/rate endpoint.
 *
 * Lookup order (fastest → safest fallback):
 *  1. In-memory FX_CACHE (process lifetime)
 *  2. Redis key 'fx_rate_ngn_usd_admin' (TTL controlled by FX_TTL_MS env var)
 *  3. MongoDB FxRate document (single active document, admin-managed)
 *  4. Hardcoded safe rate: 1/1355 (~₦1,355 per $1)
 *
 * To revert to the external OpenExchangeRates service, just swap the import
 * back to './fxService' in all consumers — fxService.js is fully preserved.
 */

const REDIS_KEY = 'fx_rate_ngn_usd_admin';
const FX_TTL_MS = Number(process.env.FX_TTL_MS ?? 10 * 60 * 1000); // 10 minutes
const IN_MEMORY_TTL_MS = 15 * 1000; // 15 seconds for fast sync with Redis
const HARDCODED_SAFE_RATE = 1 / 1330; // Fallback: ~₦1,355 per $1

// In-memory fallback cache (lives for the duration of the process)
const FX_CACHE = {
    rate: null,
    expiresAt: 0,
};

// In-flight lock to prevent cache stampede
let inflightPromise = null;

/**
 * Returns the NGN → USD rate (e.g. 0.000739 means ₦1 = $0.000739).
 * The rate is admin-controlled via PUT /admin/fx/rate.
 */
async function getFxRateNGNtoUSD() {
    // ── 1. In-memory cache (still valid?) ────────────────────────────────────
    if (FX_CACHE.rate && Date.now() < FX_CACHE.expiresAt) {
        return FX_CACHE.rate;
    }

    // ── 2. Redis cache ────────────────────────────────────────────────────────
    try {
        const cached = await redis.get(REDIS_KEY);
        if (cached) {
            const { rate, expiresAt } = JSON.parse(cached);
            if (Date.now() < expiresAt) {
                // Warm the in-memory cache too but with a short TTL
                FX_CACHE.rate = rate;
                FX_CACHE.expiresAt = Date.now() + IN_MEMORY_TTL_MS;
                return rate;
            }
            // Stale Redis entry — serve stale, revalidate in background
            if (!inflightPromise) {
                revalidateRate().catch(err =>
                    console.error('[AdminFX] Background revalidation failed:', err.message)
                );
            }
            return rate;
        }
    } catch (redisError) {
        console.error('[AdminFX] Redis read error:', redisError.message);
    }

    // ── 3. No cache — wait for fresh DB lookup ────────────────────────────────
    return revalidateRate();
}

/**
 * Fetches fresh rate from MongoDB and populates Redis + in-memory cache.
 */
async function revalidateRate() {
    if (inflightPromise) return inflightPromise;

    inflightPromise = (async () => {
        try {
            const rateDoc = await FxRate.findOne({ isActive: true }).lean();

            if (!rateDoc || !rateDoc.usdToNgnRate) {
                console.warn(
                    '[AdminFX] CRITICAL: No active FX rate found in DB. ' +
                    'Admin must set a rate via PUT /api/v1/admin/fx/rate. ' +
                    `Using hardcoded safe rate: 1/1355 (~₦1,355 per $1).`
                );
                // Still cache this fallback briefly so we don't hammer the DB
                await cacheRate(HARDCODED_SAFE_RATE);
                return HARDCODED_SAFE_RATE;
            }

            const rate = 1 / rateDoc.usdToNgnRate;
            await cacheRate(rate);

            console.log(`[AdminFX] Rate loaded from DB: $1 = ₦${rateDoc.usdToNgnRate} (ngnToUsd: ${rate.toFixed(8)})`);
            return rate;

        } catch (error) {
            console.error('[AdminFX] DB lookup failed:', error.message);

            // ── 4. All caches failed — use in-memory last known rate or hardcoded ──
            if (FX_CACHE.rate) {
                console.warn('[AdminFX] Using stale in-memory rate as last resort.');
                return FX_CACHE.rate;
            }

            console.warn('[AdminFX] Using hardcoded safe rate as absolute last resort.');
            return HARDCODED_SAFE_RATE;

        } finally {
            inflightPromise = null;
        }
    })();

    return inflightPromise;
}

/**
 * Writes rate to both Redis and in-memory cache.
 */
async function cacheRate(rate) {
    const expiresAt = Date.now() + FX_TTL_MS;
    const payload = JSON.stringify({ rate, expiresAt });

    // Update in-memory cache with short TTL
    FX_CACHE.rate = rate;
    FX_CACHE.expiresAt = Date.now() + IN_MEMORY_TTL_MS;

    // Update Redis cache (non-fatal if it fails)
    try {
        await redis.set(REDIS_KEY, payload, 'PX', FX_TTL_MS);
    } catch (redisErr) {
        console.error('[AdminFX] Redis write error:', redisErr.message);
    }
}

/**
 * Converts a NGN amount to USD.
 * @param {number} amountNGN  - Amount in Nigerian Naira
 * @param {number|null} rate  - Pre-fetched rate (optional; will fetch if not provided)
 * @returns {number}          - Amount in USD (high precision)
 */
async function convertNGNtoUSD(amountNGN, rate = null) {
    const fxRate = rate ?? await getFxRateNGNtoUSD();
    return amountNGN * fxRate;
}

module.exports = {
    getFxRateNGNtoUSD,
    convertNGNtoUSD,
};
