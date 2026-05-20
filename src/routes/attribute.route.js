const express = require('express');
const {
    createAttribute,
    getAttributes,
    getAttribute,
    updateAttribute,
    deleteAttribute
} = require('../controllers/attributeController');
const { validateToken, isAdmin, requirePermission } = require('../Admin/middleware/accessControlValidation');
const validateObjectId = require('../middlewares/validateObjectId');

const router = express.Router();

// Read routes — public (sellers/buyers need attribute data for product forms)
router.get('/', getAttributes);
router.get('/:id', validateObjectId('id'), getAttribute);

// Write routes — admin only
router.post('/', validateToken, isAdmin, requirePermission('attributes'), createAttribute);
router.put('/:id', validateToken, isAdmin, requirePermission('attributes'), validateObjectId('id'), updateAttribute);
router.delete('/:id', validateToken, isAdmin, requirePermission('attributes'), validateObjectId('id'), deleteAttribute);

module.exports = router;
