const { Category, SubCategory } = require('../models/categoryModel');
const mongoose = require('mongoose');

const createCategory = async (req, res) => {
  const { name, description } = req.body;

  try {
    const newCategory = new Category({
      name,
      description
    });

    await newCategory.save();

    return res.status(201).json({
      status: 201,
      success: true,
      message: 'Category created successfully',
      data: newCategory
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await Category.aggregate([
      {
        $lookup: {
          from: 'subcategories',
          localField: '_id',
          foreignField: 'categoryId',
          as: 'subcategories'
        }
      },

      {
        $project: {
          name: 1,
          description: 1,
          subcategories: 1
        }
      }
    ]);

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Categories fetched successfully',
      data: categories
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const category = await Category.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(id) }
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: '_id',
          foreignField: 'categoryId',
          as: 'subcategories'
        }
      },
      {
        $project: {
          name: 1,
          description: 1,
          subcategories: 1
        }
      }
    ]);

    if (category.length === 0) {
      return res.status(404).json({
        status: 404,
        success: false,
        message: 'Category not found'
      });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Category fetched successfully',
      data: category
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const category = await Category.findByIdAndDelete(id);

    return res.status(204).json({
      status: 204,
      success: true
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const createSubcategory = async (req, res) => {
  const { name, description, categoryId } = req.body;

  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: 'Category not found' });
    }

    const newSubcategory = new SubCategory({
      name,
      description,
      categoryId
    });

    await newSubcategory.save();

    return res.status(201).json({
      status: 201,
      success: true,
      message: 'Subcategory created successfully',
      data: newSubcategory
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const getSubcategories = async (req, res) => {
  const { categoryId } = req.params;

  if (!categoryId) {
    return res.status(400).json({
      success: false,
      message: 'Category ID is required'
    });
  }

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid category ID'
    });
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    return res
      .status(404)
      .json({ success: false, message: 'Category not found' });
  }

  try {
    const subCategories = await SubCategory.find({ categoryId });

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Subcategories fetched successfully',
      data: subCategories
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategory,
  deleteCategory,
  createSubcategory,
  getSubcategories
};
