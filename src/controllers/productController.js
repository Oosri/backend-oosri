const Product = require('../models/productModel');
const path = require('path');
const { Readable } = require('stream');
const ftpClient = require('basic-ftp');
const { categoryEnum } = require('../models/categoryModel');

const createProduct = async (req, res) => {
  const client = new ftpClient.Client();
  client.ftp.verbose = true;

  try {
    const { category, ...productData } = req.body;

    if (!Array.isArray(categoryEnum) || !categoryEnum.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const seller = req.seller;

    if (!seller || !seller.isVerified) {
      return res
        .status(403)
        .json({ message: 'Only verified sellers can add products' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: false,
      port: process.env.FTP_PORT || 21
    });

    const images = [];
    for (const file of req.files) {
      const uniqueFileName = `${Date.now()}-${file.originalname}`;
      const remoteFilePath = `/public_html/product_images/${uniqueFileName}`;

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

      const imageUrl = `https://${process.env.FTP_HOST}/product_images/${uniqueFileName}`;
      images.push(imageUrl);
    }

    const product = new Product({
      ...productData,
      category,
      seller: seller._id,
      isApproved: false,
      images
    });

    await product.save();

    return res.status(201).json({
      status: 201,
      success: true,
      message: 'Product added successfully',
      data: product
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

const getProducts = async (req, res) => {
  try {
    const { category } = req.query;

    let query = { isApproved: true };

    if (category) {
      query.category = category;
    }

    const products = await Product.find(query);

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Successfully fetched all products',
      data: products
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

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({ _id: id, isApproved: true });
    if (!product) {
      return res
        .status(404)
        .json({ message: 'Product not found or not approved' });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Product fetched successfully',
      data: product
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

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const seller = req.seller;
    const updateData = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.seller.toString() !== seller._id.toString()) {
      return res
        .status(403)
        .json({ message: 'You can only update your own products' });
    }

    Object.keys(updateData).forEach((key) => {
      product[key] = updateData[key];
    });

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
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

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const seller = req.seller;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.seller.toString() !== seller._id.toString()) {
      return res
        .status(403)
        .json({ message: 'You can only delete your own products' });
    }

    await Product.findByIdAndDelete(id);

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Product deleted successfully'
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

const approveProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { action } = req.body; // "approve" or "reject"

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (action === 'approve') {
      product.isApproved = true;
      await product.save();
      return res
        .status(200)
        .json({ message: 'Product approved successfully', product });
    } else if (action === 'reject') {
      await product.remove();
      return res.status(200).json({ message: 'Product rejected and removed' });
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  approveProduct
};
