require("dotenv").config();
const app = require('./src/configs/app');
const cron = require('node-cron');
const axios = require('axios');
const dbConnect = require('./src/configs/database');

const port = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${port}`;
const enableSelfPing = process.env.ENABLE_SELF_PING === 'true';

if (enableSelfPing) {
  cron.schedule('*/10 * * * *', async () => {
    try {
      const response = await axios.get(BASE_URL);
      console.log('Self-ping response:', response.status, response.data);
    } catch (error) {
      console.error('Self-ping failed:', error.message);
    }
  });
  console.log('Self-ping cron scheduled (every 10 minutes).');
}

const startServer = async () => {
  try {
    await dbConnect();
    app.listen(port, () => {
      console.log(`Server is running successfully on port: ${port}`);
      require('./src/workers/email.worker');
      require('./src/workers/image.worker');
      console.log('Email and Image workers started.');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
