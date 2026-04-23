const express = require('express');
const {
  createCategory,
  getCategories,
  getCategory,
  deleteCategory,
  createSubcategory,
  getSubcategories,
  updateCategory,
  updateSubcategory
} = require('../controllers/categoryController');

const router = express.Router();

router.post('/', createCategory);
router.get('/', getCategories);
router.get('/:id', getCategory);
router.delete('/:id', deleteCategory);
router.post('/subcategory', createSubcategory);
router.get('/:categoryId/subcategory', getSubcategories);
router.put('/:id', updateCategory);
router.put('/:categoryId/subcategory/:id', updateSubcategory);

module.exports = router;
