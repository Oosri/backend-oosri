const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = req.uploadPath;

        const folderPath = uploadPath ? uploadPath : path.join(__dirname, '../../public_html');
        
        cb(null, folderPath);
    },
    filename: (req, file, cb) => {
        const timestamp = new Date().getTime();
        cb(null, timestamp + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 3 }
});

module.exports = { upload }