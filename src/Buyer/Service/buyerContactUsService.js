const contactUs = require('../models/buyerContactUsModel');
const sendEmail = require('../../utils/emailService');
const validator = require('validator');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');

module.exports = {

  contactUs: async ({ email, fullName, message }) => {
    try {
      if (!validator.isEmail(email)) {
        throw new Error(constants.buyerAuthMessage.INVALID_EMAIL);
      }

      const newContact = new contactUs({
        email,
        fullName,
        message
      });

     // await sendEmail.sendOtpEmail(email,  fullName);

      const result = await newContact.save();

      return mongoDbDataFormat.formatMongoData(result);

    } catch (error) {
      console.log('Something went wrong: Service: contactUs', error);
      throw new Error(`Service Error: ${error.message}`);
    }
  },

};
