const Joi = require('@hapi/joi');

/**
 * Joi schema for setting the NGN/USD exchange rate.
 *
 * Admin enters the rate as a whole number: how many NGN = 1 USD.
 * e.g. usdToNgnRate: 1350  means  $1 = ₦1,350
 *
 * Guards:
 *  - min(100): prevents obviously wrong values (< ₦100 per $1)
 *  - max(10000): prevents obviously wrong values (> ₦10,000 per $1)
 */
module.exports.setRateSchema = Joi.object().keys({
    usdToNgnRate: Joi.number().integer().min(100).max(10000).required(),
    note: Joi.string().max(200).optional().allow(''),
});
