const { randomInt } = require('crypto');

const generateOtpCode = (digits) => {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits);
  return randomInt(min, max).toString();
};

module.exports = generateOtpCode;
