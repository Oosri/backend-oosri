const express = require('express');
const router = express.Router();
const adminAuditLogController = require('../controllers/adminAuditLogController');
const accessControlValidation = require('../middleware/accessControlValidation');

router.get(
  '/',
  accessControlValidation.validateToken,
  accessControlValidation.isAdmin,
  adminAuditLogController.getAuditLogs
);

module.exports = router;
