// List of Stripe zero-decimal currencies:
// https://docs.stripe.com/currencies#zero-decimal
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF",
  "KRW", "MGA", "PYG", "RWF", "UGX", "VND",
  "VUV", "XAF", "XOF", "XPF"
]);

/**
 * Convert a normal decimal amount (e.g. 10.50)
 * into Stripe's expected smallest currency unit.
 *
 * @param {number} amount - The amount entered by user.
 * @param {string} currency - ISO currency code, e.g. 'usd', 'eur', 'ngn'.
 * @returns {number} - Stripe-safe amount.
 */
function toStripeAmount(amount, currency) {
  if (!amount || !currency) {
    throw new Error("Amount and currency are required.");
  }

  const code = currency.toUpperCase();

  if (ZERO_DECIMAL_CURRENCIES.has(code)) {
    // These currencies do not use cents.
    return Math.round(amount);
  }

  // All other currencies use cents.
  return Math.round(amount * 100);
}

module.exports = { toStripeAmount };
