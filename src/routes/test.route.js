const express = require('express');
const { manualTriggerProductReminder } = require('../utils/productReminder');
const { sendProductUploadReminder } = require('../utils/emailService');

const router = express.Router();

router.get('/send-test-reminder', async (req, res, next) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({
      status: 'error',
      message:
        'Please provide an email address as a query parameter (e.g., ?email=test@example.com)'
    });
  }

  try {
    console.log(
      `API endpoint hit: /test/send-test-reminder for email: ${email}`
    );
    await sendProductUploadReminder(email, 'Test Seller');
    res.status(200).json({
      status: 'success',
      message: `Test product upload reminder email sent to ${email}.`
    });
  } catch (error) {
    console.error(`Error sending test reminder email to ${email}:`, error);
    // Forward to the global error handler
    next(error);
  }
});

module.exports = router;
