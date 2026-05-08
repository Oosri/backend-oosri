const express = require('express');
const {
    createAttribute,
    getAttributes,
    getAttribute,
    updateAttribute,
    deleteAttribute
} = require('../controllers/attributeController');
const { validateToken, isAdmin } = require('../Admin/middleware/accessControlValidation');

const router = express.Router();

// Read routes — public (sellers/buyers need attribute data for product forms)
router.get('/', getAttributes);
router.get('/:id', getAttribute);

// Write routes — admin only
router.post('/', validateToken, isAdmin, createAttribute);
router.put('/:id', validateToken, isAdmin, updateAttribute);
router.delete('/:id', validateToken, isAdmin, deleteAttribute);

module.exports = router;
