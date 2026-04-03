const fs = require('fs');
const path = require('path');

const loadTemplate = (templateName) => {
    const filePath = path.join(__dirname, 'templates', templateName);
    return fs.readFileSync(filePath, 'utf8');
};

const replacePlaceholders = (template, placeholders) => {
    return template.replace(/{{\s*(\w+)\s*}}/g, (match, key) => {
        return placeholders[key] !== undefined ? placeholders[key] : match;
    });
};

const verify = () => {
    console.log('🔍 Verifying Reminder Templates...');

    const placeholders = {
        image_url: 'https://res.cloudinary.com/demo/image/upload',
        sellerName: 'John Doe'
    };

    try {
        const t1 = loadTemplate('reminderTemplate1.html');
        if (t1.includes('res.cloudinary.com')) {
            console.log('✅ Template 1 verified (contains Cloudinary URLs).');
        } else {
            console.error('❌ Template 1 verification failed: no Cloudinary URLs found.');
        }

        const t2 = loadTemplate('verifiedReminderTemplate2.html');
        const r2 = replacePlaceholders(t2, placeholders);
        if (r2.includes('John Doe') && r2.includes('res.cloudinary.com')) {
            console.log('✅ Template 2 verified (seller name replaced and contains Cloudinary URLs).');
        } else {
            console.error('❌ Template 2 verification failed: placeholders or Cloudinary URLs missing.');
        }
    } catch (error) {
        console.error('❌ Verification failed with error:', error.message);
    }
};

verify();
