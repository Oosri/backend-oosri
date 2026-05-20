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
const validateObjectId = require('../middlewares/validateObjectId');
const { validateToken, isAdmin, requirePermission } = require('../Admin/middleware/accessControlValidation');

const router = express.Router();

// Read routes — public (buyers/sellers need category data)
router.get('/', getCategories);
router.get('/:id', validateObjectId('id'), getCategory);
router.get('/:categoryId/subcategory', validateObjectId('categoryId'), getSubcategories);

// Write routes — admin + categories permission
router.post('/', validateToken, isAdmin, requirePermission('categories'), createCategory);
router.delete('/:id', validateToken, isAdmin, requirePermission('categories'), validateObjectId('id'), deleteCategory);
router.post('/subcategory', validateToken, isAdmin, requirePermission('categories'), createSubcategory);
router.put('/:id', validateToken, isAdmin, requirePermission('categories'), validateObjectId('id'), updateCategory);
router.put('/:categoryId/subcategory/:id', validateToken, isAdmin, requirePermission('categories'), validateObjectId('categoryId'), validateObjectId('id'), updateSubcategory);

module.exports = router;
