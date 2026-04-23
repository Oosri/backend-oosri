const cloudinary = require('cloudinary').v2;

const generateSignature = (req, res) => {
  try {
    const { folder = 'uploads' } = req.query;
    
    // Cloudinary signature timestamp
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Generate signature using API secret
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: folder
      },
      process.env.CLOUDINARY_API_SECRET
    );

    return res.status(200).json({
      success: true,
      data: {
        timestamp,
        signature,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        folder
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to generate upload signature',
      error: error.message
    });
  }
};

module.exports = {
  generateSignature
};
