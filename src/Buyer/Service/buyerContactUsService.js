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

      const result = await newContact.save();

      try {
        await sendEmail.contactUsNotification(email, fullName, message);
      } catch (emailError) {
        console.error('Failed to send contact us notification email, but saved to db:', emailError);
      }

      return mongoDbDataFormat.formatMongoData(result);

    } catch (error) {
      console.error('Something went wrong: Service: contactUs', error);
      throw new Error(`Service Error: ${error.message}`);
    }
  },

};
