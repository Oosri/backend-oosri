const mongoose = require('mongoose');

const dbConnect = async () => {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        throw new Error('MONGO_URI is not configured');
    }

    mongoose.set('bufferCommands', false);

    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        mongoose.connection.on('error', (error) => {
            console.error('MongoDB connection error:', error.message);
        });

        mongoose.connection.on('disconnected', () => {
            console.error('MongoDB disconnected');
        });

        console.log('Successfully Connected to the database...');
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error.message);
        throw error;
    }
};

module.exports = dbConnect;
