// const generateOtpCode = (digits) => {
//     const max = Math.pow(10, digits) - 1;
//     const min = Math.pow(10, digits - 1);
//     return Math.floor(Math.random() * (max - min + 1)) + min;
// };
const generateOtpCode = (digits) => {
    const max = Math.pow(10, digits) - 1;
    const min = Math.pow(10, digits - 1);
    // Convert the OTP to a string before returning
    return (Math.floor(Math.random() * (max - min + 1)) + min).toString();
};

module.exports = generateOtpCode;
