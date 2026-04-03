
require('dotenv').config();
const { sendOtpEmail } = require('./src/utils/emailService');


sendOtpEmail('yusuffogundeji@gmail.com', '1234', 'Test User')
  .then(() => console.log('✓ Test email sent!'))
  .catch(err => console.error('✗ Failed:', err));