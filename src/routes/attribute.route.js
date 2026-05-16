const express = require('express');
const {
    createAttribute,
    getAttributes,
    getAttribute,
    updateAttribute,
    deleteAttribute
} = require('../controllers/attributeController');
const { validateToken, isAdmin, requirePermission } = require('../Admin/middleware/accessControlValidation');

const router = express.Router();

// Read routes — public (sellers/buyers need attribute data for product forms)
router.get('/', getAttributes);
router.get('/:id', getAttribute);

// Write routes — admin only
router.post('/', validateToken, isAdmin, requirePermission('attributes'), createAttribute);
router.put('/:id', validateToken, isAdmin, requirePermission('attributes'), updateAttribute);
router.delete('/:id', validateToken, isAdmin, requirePermission('attributes'), deleteAttribute);

module.exports = router;
