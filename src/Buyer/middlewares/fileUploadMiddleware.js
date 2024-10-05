// upload.js
const multer = require('multer');
const path = require('path');

// Use memory storage to avoid local file storage
const storage = multer.memoryStorage();

// File type check function
function checkFileType(file, cb) {
  // Allowed file types
  const filetypes = /jpeg|jpg|png|gif/; // You can add more image formats if needed
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true); // File type is acceptable
  } else {
    cb('Error: Images Only!'); // Reject the file
  }
}

// Create the multer instance
const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 }, // Limit file size to 1MB
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb); // Call the file type check
  },
});

module.exports = upload;
