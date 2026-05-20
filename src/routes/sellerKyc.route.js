const express = require('express');
const { sellerAuth } = require('../middlewares/auth.middleware');
const { kycDocumentUpload, handleMulterError } = require('../middlewares/cloudinaryUploadMiddleware');
const { submitKyc, getMyKyc } = require('../controllers/sellerKycController');

const router = express.Router();

router.get('/', sellerAuth, getMyKyc);

router.post(
  '/',
  sellerAuth,
  kycDocumentUpload.fields([
    { name: 'governmentId', maxCount: 1 },
    { name: 'proofOfAddress', maxCount: 1 },
    { name: 'businessCertificate', maxCount: 1 }
  ]),
  handleMulterError,
  submitKyc
);

module.exports = router;
