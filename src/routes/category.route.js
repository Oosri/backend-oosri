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
const { validateToken, isAdmin, requirePermission } = require('../Admin/middleware/accessControlValidation');

const router = express.Router();

// Read routes — public (buyers/sellers need category data)
router.get('/', getCategories);
router.get('/:id', getCategory);
router.get('/:categoryId/subcategory', getSubcategories);

// Write routes — admin + categories permission
router.post('/', validateToken, isAdmin, requirePermission('categories'), createCategory);
router.delete('/:id', validateToken, isAdmin, requirePermission('categories'), deleteCategory);
router.post('/subcategory', validateToken, isAdmin, requirePermission('categories'), createSubcategory);
router.put('/:id', validateToken, isAdmin, requirePermission('categories'), updateCategory);
router.put('/:categoryId/subcategory/:id', validateToken, isAdmin, requirePermission('categories'), updateSubcategory);

module.exports = router;
