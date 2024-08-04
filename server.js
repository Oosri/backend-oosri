const app = require('./src/configs/app')

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server is running successfully on port: ${port}`);
});