const express = require('express');
const {
  createCategory,
  getCategories,
  getCategory,
  deleteCategory,
  createSubcategory,
  getSubcategories
} = require('../controllers/categoryController');

const router = express.Router();

router.post('/', createCategory);
router.get('/', getCategories);
router.get('/:id', getCategory);
router.delete('/:id', deleteCategory);
router.post('/subcategory', createSubcategory);
router.get('/:categoryId/subcategory', getSubcategories);

module.exports = router;
