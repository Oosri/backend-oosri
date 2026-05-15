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

const router = express.Router();

router.post('/', createCategory);
router.get('/', getCategories);
router.get('/:id', validateObjectId('id'), getCategory);
router.delete('/:id', validateObjectId('id'), deleteCategory);
router.post('/subcategory', createSubcategory);
router.get('/:categoryId/subcategory', validateObjectId('categoryId'), getSubcategories);
router.put('/:id', validateObjectId('id'), updateCategory);
router.put('/:categoryId/subcategory/:id', validateObjectId('categoryId'), validateObjectId('id'), updateSubcategory);

module.exports = router;
