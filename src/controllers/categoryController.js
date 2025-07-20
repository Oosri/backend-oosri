const { Category, SubCategory } = require('../models/categoryModel');
const mongoose = require('mongoose');
const ftpClient = require('basic-ftp');
const { Readable } = require('stream');

const createCategory = async (req, res) => {
  const client = new ftpClient.Client();
  client.ftp.verbose = true;

  try {
    const { name, description } = req.body;

    const file = req.file;
    if (!file) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'No image file uploaded'
      });
    }

    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: false,
      port: process.env.FTP_PORT || 21
    });

    const uniqueFileName = `${Date.now()}-${file.originalname}`;
    const remoteFilePath = `/public_html/categories/${uniqueFileName}`;

    const stream = new Readable();
    stream.push(file.buffer);
    stream.push(null);

    try {
      await client.uploadFrom(stream, remoteFilePath);
    } catch (uploadError) {
      return res.status(500).json({
        message: `Failed to upload ${file.originalname}`,
        error: uploadError.message
      });
    }

    const imageUrl = `https://${process.env.FTP_HOST}/categories/${uniqueFileName}`;

    const newCategory = new Category({
      name,
      description,
      image: imageUrl
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
          subcategories: 1,
          image: 1
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
          subcategories: 1,
          image: 1
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

const updateCategory = async (req, res) => {
  const client = new ftpClient.Client();
  client.ftp.verbose = true;

  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const file = req.file;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Invalid category ID'
      });
    }

    if (!name && !description && !file) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'No update data provided'
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;

    if (file) {
      await client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: false,
        port: process.env.FTP_PORT || 21
      });

      const uniqueFileName = `${Date.now()}-${file.originalname}`;
      const remoteFilePath = `/public_html/categories/${uniqueFileName}`;

      const stream = new Readable();
      stream.push(file.buffer);
      stream.push(null);

      await client.uploadFrom(stream, remoteFilePath);
      updateData.image = `https://${process.env.FTP_HOST}/categories/${uniqueFileName}`;
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedCategory) {
      return res
        .status(404)
        .json({ status: 404, success: false, message: 'Category not found' });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  } finally {
    client.close();
  }
};

const updateSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Invalid subcategory ID'
      });
    }

    if (!name && !description) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'No update data provided'
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;

    const updatedSubcategory = await SubCategory.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedSubcategory) {
      return res.status(404).json({
        status: 404,
        success: false,
        message: 'Subcategory not found'
      });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Subcategory updated successfully',
      data: updatedSubcategory
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
  getSubcategories,
  updateCategory,
  updateSubcategory
};
