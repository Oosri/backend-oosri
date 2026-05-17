const express = require('express');
const router = express.Router();
const adminManagementController = require('../controllers/adminManagementController');
const { validateToken, isAdmin, isSuperAdmin } = require('../middleware/accessControlValidation');
const joiSchemaValidation = require('../middleware/joiSchemaValidation');
const adminAuthSchema = require('../apiSchema/adminAuthSchema');

// All routes: must be authenticated admin + super_admin
router.use(validateToken, isAdmin, isSuperAdmin);

router.get('/', adminManagementController.listAdmins);
router.get('/:id', adminManagementController.getAdmin);
router.post(
  '/',
  joiSchemaValidation.validateBody(adminAuthSchema.createAdmin),
  adminManagementController.createAdmin
);
router.put('/:id', adminManagementController.updateAdmin);
router.delete('/:id', adminManagementController.deleteAdmin);

module.exports = router;
