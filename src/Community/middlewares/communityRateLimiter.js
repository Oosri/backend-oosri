const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { DISCUSSION_RATE_LIMIT, NEGOTIATION_RATE_LIMIT } = require('../constants/community');

const keyGenerator = (req) => {
  return req.user?.id || req.community?.actorId?.toString() || ipKeyGenerator(req.ip);
};

const discussionLimiter = rateLimit({
  windowMs: DISCUSSION_RATE_LIMIT.windowMs,
  max: DISCUSSION_RATE_LIMIT.max,
  keyGenerator,
  message: {
    status: 429,
    success: false,
    message: 'Too many posts. Please wait a moment before posting again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const negotiationLimiter = rateLimit({
  windowMs: NEGOTIATION_RATE_LIMIT.windowMs,
  max: NEGOTIATION_RATE_LIMIT.max,
  keyGenerator,
  message: {
    status: 429,
    success: false,
    message: 'Too many negotiation requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { discussionLimiter, negotiationLimiter };
