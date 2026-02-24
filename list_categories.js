const mongoose = require('mongoose');
const { Category } = require('./src/models/categoryModel');
require('dotenv').config();

const listCategories = async () => {
    try {
        const dbUrl = process.env.MONGO_URI || process.env.MONGO_URI_DEV;
        await mongoose.connect(dbUrl);
        console.log('Connected to DB');

        const categories = await Category.find({});
        console.log('Categories found:', categories.length);
        categories.forEach(c => {
            console.log(`- ID: ${c._id}, Name: "${c.name}", Attributes: ${c.attributes ? c.attributes.length : 'MISSING'}`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

listCategories();
