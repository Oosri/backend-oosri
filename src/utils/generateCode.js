const generateOtpCode = (digits) => {
    const max = Math.pow(10, digits) - 1;
    const min = Math.pow(10, digits - 1);
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

module.exports = generateOtpCode;
