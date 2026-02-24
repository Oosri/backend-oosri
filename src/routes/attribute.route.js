const express = require('express');
const {
    createAttribute,
    getAttributes,
    getAttribute,
    updateAttribute,
    deleteAttribute
} = require('../controllers/attributeController');

const router = express.Router();

// TODO: Add admin authentication middleware
router.post('/', createAttribute);
router.get('/', getAttributes);
router.get('/:id', getAttribute);
router.put('/:id', updateAttribute);
router.delete('/:id', deleteAttribute);

module.exports = router;
