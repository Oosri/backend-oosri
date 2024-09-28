const app = require('./src/configs/app')
const bodyParser = require('body-parser');


const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server is running successfully on port: ${port}`);
});

app.use(bodyParser.urlencoded({ extended: true })); 
app.use(bodyParser.json());

app.use((req, res, next) => {
    const error = new Error('Not found');
    error.status = 404;
    next(error);
  });
  
  app.use((error, req, res, next) => {
    res.status(error.status || 500).send({
      status: error.status || 500,
      message: error.message,
      body: {}
    });
  });