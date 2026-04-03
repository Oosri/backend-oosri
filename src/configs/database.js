const mongoose = require('mongoose');

const dbConnect = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Successfully Connected to the database...');
    } catch (error) {
        console.log(error);
    }
}

module.exports = dbConnect;