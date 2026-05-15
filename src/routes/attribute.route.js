const express = require('express');
const {
    createAttribute,
    getAttributes,
    getAttribute,
    updateAttribute,
    deleteAttribute
} = require('../controllers/attributeController');
const { validateToken, isAdmin } = require('../Admin/middleware/accessControlValidation');
const validateObjectId = require('../middlewares/validateObjectId');

const router = express.Router();

// Read routes — public (sellers/buyers need attribute data for product forms)
router.get('/', getAttributes);
router.get('/:id', validateObjectId('id'), getAttribute);

// Write routes — admin only
router.post('/', validateToken, isAdmin, createAttribute);
router.put('/:id', validateObjectId('id'), validateToken, isAdmin, updateAttribute);
router.delete('/:id', validateObjectId('id'), validateToken, isAdmin, deleteAttribute);

module.exports = router;
