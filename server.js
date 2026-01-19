const app = require('./src/configs/app')
const bodyParser = require('body-parser');


const port = process.env.PORT || 3000;
const dotEnv = require('dotenv');


require("dotenv").config();
dotEnv.config();
const cron = require('node-cron');
const axios = require('axios');
const dbConnect = require('./src/configs/database');


const BASE_URL = `http://localhost:${port}`;

app.get('/', (req, res) => {
  res.status(200).send('Server is running');
});

cron.schedule('*/10 * * * *', async () => {
  console.log('Running scheduled task to query the base server URL...');

  try {
    const response = await axios.get(BASE_URL);
    console.log('Server Response:', response.status, response.data);
  } catch (error) {
    console.error('Error querying the server:', error.message);
  }
});

console.log('Cron job scheduled to run every 10 minute.');


// app.listen(port, () => {
//   console.log(`Server is running successfully on port: ${port}`);
//   // Initialize Background Workers
//   require('./src/workers/email.worker');
// });

const startServer = async () => {
  try {
    // Await DB Connection BEFORE listening
    await dbConnect();

    app.listen(port, () => {
      console.log(`Server is running successfully on port: ${port}`);
      // Initialize Background Workers
      require('./src/workers/email.worker');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// app.use(bodyParser.urlencoded({ extended: true })); 
// app.use(bodyParser.json());

app.use((req, res, next) => {
  const error = new Error('Route not found');
  error.status = 404;
  next(error);
});

app.use((error, req, res, next) => {
  console.error('Global Error Handler:', error);
  const response = {
    status: error.status || 500,
    message: error.message,
    body: {}
  };

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    response.message = `Unexpected field: ${error.field}`;
    response.hint = `Expected field name: 'images' (without brackets)`;
  }

  res.status(response.status).send(response);
});

