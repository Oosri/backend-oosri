const { Product, Sculpture, Textiles, Pottery, Jewelry, Paintings } = require('../models/productModel');
const Category = require('../models/categoryModel'); 
const ftpClient = require('basic-ftp');
const { Readable } = require('stream');
const path = require('path');

const createProduct = async (req, res) => {
  const client = new ftpClient.Client();
  client.ftp.verbose = true;

  try {
    const { category, subcategory, brandArtist, ...productData } = req.body;


    const seller = req.seller;
    if (!seller || !seller.isVerified) {
      return res
        .status(403)
        .json({ message: 'Only verified sellers can add products' });
    }

    if (!brandArtist) {
      return res.status(400).json({ error: 'Brand artist is required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: false,
      port: process.env.FTP_PORT || 21,
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
          error: uploadError.message,
        });
      }

      const imageUrl = `https://${process.env.FTP_HOST}/product_images/${uniqueFileName}`;
      images.push(imageUrl);
    }

    let product;
    switch (category) {
      case 'Sculpture':
        product = new Sculpture({
          ...productData,
          category,
          subcategory,
          seller: seller._id,
          images,
          brandArtist,
          isApproved: false,
          height: productData.height,
          width: productData.width,
          weight: productData.weight,
          technique: productData.technique,
        });
        break;

      case 'Textiles':
        product = new Textiles({
          ...productData,
          category,
          subcategory,
          seller: seller._id,
          images,
          brandArtist,
          isApproved: false,
          length: productData.length,
          width: productData.width,
          weight: productData.weight,
          fabricType: productData.fabricType,
          pattern: productData.pattern,
        });
        break;

      case 'Pottery':
        product = new Pottery({
          ...productData,
          category,
          subcategory,
          seller: seller._id,
          images,
          brandArtist,
          isApproved: false,
          height: productData.height,
          diameter: productData.diameter,
          clayType: productData.clayType,
          glaze: productData.glaze,
        });
        break;

      case 'Jewelry':
        product = new Jewelry({
          ...productData,
          category,
          subcategory,
          seller: seller._id,
          images,
          brandArtist,
          isApproved: false,
          length: productData.length,
          diameter: productData.diameter,
          stoneType: productData.stoneType,
          metalType: productData.metalType,
        });
        break;

      case 'Paintings':
        product = new Paintings({
          ...productData,
          category,
          subcategory,
          seller: seller._id,
          images,
          brandArtist,
          isApproved: false,
          medium: productData.medium,
          condition: productData.condition,
          size: productData.size,
          dimension: productData.dimension,
        });
        break;

      default:
        return res.status(400).json({ error: 'Unsupported category' });
    }

    await product.save();

    return res.status(201).json({
      status: 201,
      success: true,
      message: 'Product added successfully',
      data: product,
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  } finally {
    client.close();
  }
};




const getProducts = async (req, res) => {
  try {
    const { category, subcategory } = req.query;

    let query = {}; 

    //TODO: Uncomment later
    // query.isApproved = true;  

    if (category) {
      const categoryExists = await Category.findOne({ name: category });

      if (!categoryExists) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Invalid category'
        });
      }

      query.category = category;

      if (subcategory) {
        const subCategoryExists = categoryExists.subcategories.some(
          (sub) => sub.name === subcategory
        );

        if (!subCategoryExists) {
          return res.status(400).json({
            status: 400,
            success: false,
            message: 'Invalid subcategory'
          });
        }

        query.subcategory = subcategory; 
      }
    }

    const products = await Product.find(query);

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Successfully fetched products',
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
  const client = new ftpClient.Client();
  client.ftp.verbose = true;

  try {
    const { id } = req.params;
    const {deleteImages, ...productData } = req.body;

    const seller = req.seller;
    if (!seller || !seller.isVerified) {
      return res
        .status(403)
        .json({ message: 'Only verified sellers can update products' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (product.seller.toString() !== seller._id.toString()) {
      return res.status(403).json({ message: 'You can only update your own products' });
    }

    let images = product.images || [];
    if (deleteImages && Array.isArray(deleteImages)) {
      images = images.filter(img => !deleteImages.includes(img));
    }

    if (req.files && req.files.length > 0) {
      await client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: false,
        port: process.env.FTP_PORT || 21,
      });

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
            error: uploadError.message,
          });
        }

        const imageUrl = `https://${process.env.FTP_HOST}/product_images/${uniqueFileName}`;
        images.push(imageUrl);
      }
    }

    const updatedData = {
      ...productData,
      images,
    };

    const category = product.category;
    let ModelToUpdate;
    switch (category) {
      case 'Sculpture':
        ModelToUpdate = Sculpture;
        break;
      case 'Textiles':
        ModelToUpdate = Textiles;
        break;
      case 'Pottery':
        ModelToUpdate = Pottery;
        break;
      case 'Jewelry':
        ModelToUpdate = Jewelry;
        break;
      case 'Paintings':
        ModelToUpdate = Paintings;
        break;
      default:
        return res.status(400).json({ error: 'Unsupported category' });
    }

    const updatedProduct = await ModelToUpdate.findByIdAndUpdate(
      id,
      { $set: updatedData },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Failed to update product' });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct,
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  } finally {
    client.close();
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
