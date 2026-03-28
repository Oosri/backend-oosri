const { Category, SubCategory } = require('../models/categoryModel');
const mongoose = require('mongoose');
const { uploadFromStream } = require('../utils/cloudinary');
const createCategory = async (req, res) => {
  try {
    const { name, description, attributes } = req.body;
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'No image file uploaded'
      });
    }
    // Upload to Cloudinary
    const timestamp = Date.now();
    const sanitizedName = file.originalname
      .split('.')[0]
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);
    const publicId = `category_${timestamp}_${sanitizedName}`;
    const result = await uploadFromStream(file.buffer, {
      folder: 'categories/images',
      resourceType: 'image',
      publicId,
      transformation: [
        { width: 800, height: 800, crop: 'limit' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ],
      allowedFormats: ['jpg', 'jpeg', 'png', 'gif']
    });
    const newCategory = new Category({
      name,
      description,
      image: result.secure_url,
      attributes: attributes ? JSON.parse(attributes) : [] // attributes might come as string if multipart/form-data
    });
    // Note: If using muliter (multipart), complex arrays/objects often come as JSON strings.
    // If sent as JSON body (application/json), it's already an object. 
    // Since this endpoint uses `upload.single('image')`, it IS multipart.
    // So we likely need to parse it if it's a string, or handle strictly JSON.
    // Let's safe parse:
    if (attributes && typeof attributes === 'string') {
      try {
        newCategory.attributes = JSON.parse(attributes);
      } catch (e) {
        // ignore or handle error? Mongoose might handle auto-casting if it's close enough? 
        // No, attributes is an array of objects.
      }
    } else if (attributes) {
      newCategory.attributes = attributes;
    }
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
      // 1. Lookup Subcategories & details
      {
        $lookup: {
          from: 'subcategories',
          localField: '_id',
          foreignField: 'categoryId',
          as: 'subcategories'
        }
      },
      // 2. Unwind attributes to populate them (preserve categories without attributes)
      {
        $unwind: {
          path: '$attributes',
          preserveNullAndEmptyArrays: true
        }
      },
      // 3. Lookup Attribute details
      {
        $lookup: {
          from: 'attributes',
          localField: 'attributes.attributeId',
          foreignField: '_id',
          as: 'attributes.details'
        }
      },
      // 4. Unwind the details array (lookup returns array)
      {
        $unwind: {
          path: '$attributes.details',
          preserveNullAndEmptyArrays: true
        }
      },
      // 5. Group back to category structure
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          description: { $first: '$description' },
          image: { $first: '$image' },
          subcategories: { $first: '$subcategories' },
          attributes: { $push: '$attributes' }
        }
      },
      // 6. Clean up attributes array (remove empty objects from unwind if no attributes existed)
      {
        $addFields: {
          attributes: {
            $filter: {
              input: { $ifNull: ['$attributes', []] },
              as: 'attr',
              cond: { $ifNull: ['$$attr.attributeId', false] }
            }
          }
        }
      },
      {
        $project: {
          name: 1,
          description: 1,
          subcategories: 1,
          image: 1,
          attributes: 1 // Include the populated attributes
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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Invalid category ID'
      });
    }

    const category = await Category.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(id) }
      },
      // 1. Lookup Subcategories & details
      {
        $lookup: {
          from: 'subcategories',
          localField: '_id',
          foreignField: 'categoryId',
          as: 'subcategories'
        }
      },
      // 2. Unwind attributes to populate them (preserve categories without attributes)
      {
        $unwind: {
          path: '$attributes',
          preserveNullAndEmptyArrays: true
        }
      },
      // 3. Lookup Attribute details
      {
        $lookup: {
          from: 'attributes',
          localField: 'attributes.attributeId',
          foreignField: '_id',
          as: 'attributes.details'
        }
      },
      // 4. Unwind the details array (lookup returns array)
      {
        $unwind: {
          path: '$attributes.details',
          preserveNullAndEmptyArrays: true
        }
      },
      // 5. Group back to category structure
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          description: { $first: '$description' },
          image: { $first: '$image' },
          subcategories: { $first: '$subcategories' },
          attributes: { $push: '$attributes' }
        }
      },
      // 6. Clean up attributes array (remove empty objects from unwind if no attributes existed)
      {
        $addFields: {
          attributes: {
            $filter: {
              input: { $ifNull: ['$attributes', []] },
              as: 'attr',
              cond: { $ifNull: ['$$attr.attributeId', false] }
            }
          }
        }
      },
      {
        $project: {
          name: 1,
          description: 1,
          subcategories: 1,
          image: 1,
          attributes: 1
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
      data: category[0]
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
  try {
    const { id } = req.params;
    const { name, description, attributes } = req.body;
    const file = req.file;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Invalid category ID'
      });
    }
    if (!name && !description && !file && !attributes) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'No update data provided'
      });
    }
    const updateData = {};
    if (attributes) {
      if (typeof attributes === 'string') {
        try {
          updateData.attributes = JSON.parse(attributes);
        } catch (e) { }
      } else {
        updateData.attributes = attributes;
      }
    }
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (file) {
      // Upload to Cloudinary
      const timestamp = Date.now();
      const sanitizedName = file.originalname
        .split('.')[0]
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50);
      const publicId = `category_${id}_${timestamp}_${sanitizedName}`;
      const result = await uploadFromStream(file.buffer, {
        folder: 'categories/images',
        resourceType: 'image',
        publicId,
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ],
        allowedFormats: ['jpg', 'jpeg', 'png', 'gif']
      });
      updateData.image = result.secure_url;
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