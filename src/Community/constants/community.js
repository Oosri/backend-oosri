const NEGOTIATION_EXPIRY_HOURS = parseInt(process.env.NEGOTIATION_EXPIRY_HOURS, 10) || 48;
const NEGOTIATION_MIN_DISCOUNT = parseFloat(process.env.NEGOTIATION_MIN_DISCOUNT) || 0.01;
const NEGOTIATION_MAX_DISCOUNT = parseFloat(process.env.NEGOTIATION_MAX_DISCOUNT) || 0.70;

const CHECKOUT_TOKEN_TTL_HOURS = parseInt(process.env.CHECKOUT_TOKEN_TTL_HOURS, 10) || 2;

const DISCUSSION_PAGE_SIZE = 20;
const REPLY_PAGE_SIZE = 10;

const DISCUSSION_RATE_LIMIT = {
  windowMs: 60 * 1000,
  max: 5,
};

const NEGOTIATION_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  max: 10,
};

const ALLOWED_REACTION_EMOJIS = ['👍', '❤️', '🔥', '😮', '🤔', '👎'];

const SOCKET_EVENTS = {
  NEGOTIATION_NEW: 'negotiation:new',
  NEGOTIATION_COUNTERED: 'negotiation:countered',
  NEGOTIATION_ACCEPTED: 'negotiation:accepted',
  NEGOTIATION_REJECTED: 'negotiation:rejected',
  NEGOTIATION_EXPIRED: 'negotiation:expired',
  DISCUSSION_NEW: 'discussion:new',
  DISCUSSION_REPLIED: 'discussion:replied',
  DISCUSSION_REACTION: 'discussion:reaction',
};

module.exports = {
  NEGOTIATION_EXPIRY_HOURS,
  NEGOTIATION_MIN_DISCOUNT,
  NEGOTIATION_MAX_DISCOUNT,
  CHECKOUT_TOKEN_TTL_HOURS,
  DISCUSSION_PAGE_SIZE,
  REPLY_PAGE_SIZE,
  DISCUSSION_RATE_LIMIT,
  NEGOTIATION_RATE_LIMIT,
  ALLOWED_REACTION_EMOJIS,
  SOCKET_EVENTS,
};
