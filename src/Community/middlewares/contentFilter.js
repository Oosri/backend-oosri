const leoProfanity = require('leo-profanity');

leoProfanity.loadDictionary('en');

const CONTENT_FIELDS = ['content', 'note', 'buyerNote'];

const contentFilter = (req, res, next) => {
  for (const field of CONTENT_FIELDS) {
    const value = req.body[field];
    if (typeof value === 'string' && leoProfanity.check(value)) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Your message contains content that violates community guidelines.',
      });
    }
  }
  next();
};

module.exports = contentFilter;
