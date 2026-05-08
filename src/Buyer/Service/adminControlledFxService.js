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
 *  4. Configurable fallback rate (FX_FALLBACK_NGN_PER_USD env var, default 1500)
 *     — used for price display only when no admin rate exists yet
 *
 * To revert to the external OpenExchangeRates service, just swap the import
 * back to './fxService' in all consumers — fxService.js is fully preserved.
 */

const REDIS_KEY = 'fx_rate_ngn_usd_admin';
const FX_TTL_MS = Number(process.env.FX_TTL_MS ?? 10 * 60 * 1000); // 10 minutes
const IN_MEMORY_TTL_MS = 15 * 1000; // 15 seconds for fast sync with Redis
// Fallback used only for price display when no admin rate has been set yet.
// Override via FX_FALLBACK_NGN_PER_USD env var to avoid a deploy when the rate drifts.
const FALLBACK_NGN_PER_USD = Number(process.env.FX_FALLBACK_NGN_PER_USD ?? 1500);
const HARDCODED_SAFE_RATE = 1 / FALLBACK_NGN_PER_USD;

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
                    `[AdminFX] No active FX rate in DB — using fallback ₦${FALLBACK_NGN_PER_USD}/$1 for price display. ` +
                    'Set a real rate via PUT /api/v1/admin/fx/rate or override FX_FALLBACK_NGN_PER_USD env var.'
                );
                await cacheRate(HARDCODED_SAFE_RATE);
                return HARDCODED_SAFE_RATE;
            }

            const rate = 1 / rateDoc.usdToNgnRate;
            await cacheRate(rate);

            console.log(`[AdminFX] Rate loaded from DB: $1 = ₦${rateDoc.usdToNgnRate} (ngnToUsd: ${rate.toFixed(8)})`);
            return rate;

        } catch (error) {
            console.error('[AdminFX] DB lookup failed:', error.message);

            // ── 4. DB unavailable — use last known admin-set rate if cached ──────
            if (FX_CACHE.rate) {
                console.warn('[AdminFX] DB unreachable — serving stale in-memory rate.');
                return FX_CACHE.rate;
            }

            console.warn(`[AdminFX] DB unreachable and no cache — using fallback ₦${FALLBACK_NGN_PER_USD}/$1.`);
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
