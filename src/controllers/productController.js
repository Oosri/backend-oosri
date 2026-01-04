const {
  Product
} = require('../models/productModel');
const { Category, SubCategory } = require('../models/categoryModel');
const mongoose = require('mongoose');
// const ftpClient = require('basic-ftp'); // removed: not used
const { Readable } = require('stream');
const path = require('path');
const User = require('../models/sellerModel');
const agenda = require('../configs/agenda');
const syncProduct = require('../Buyer/Service/buyerProductService');
const algoliasearch = require('algoliasearch');

const algoliaClient = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_SEARCH_API_KEY
);
const productIndex = algoliaClient.initIndex(
  process.env.ALGOLIA_INDEX_NAME || 'products'
);

const generateProductId = () => {
  const chars = '0123456789';
  let productId = '';
  for (let i = 0; i < 8; i++) {
    productId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return productId;
};

const {
  uploadFromStream
} = require('../utils/cloudinary'); // adjust path as needed
const { cloudinary } = require('../utils/cloudinary'); // adjust path as needed

const createProduct = async (req, res) => {
  try {
    const { categoryId, subcategoryId, brandArtist, ...productData } = req.body;
    const seller = req.seller;

    // === Security checks ===
    if (!seller || !seller.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Only verified sellers can add products',
      });
    }

    if (!brandArtist) {
      return res.status(400).json({
        success: false,
        error: 'Brand artist is required',
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one product image is required',
      });
    }

    // === Validate categoryId ===
    if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid categoryId is required',
      });
    }

    // === Validate subcategoryId (if provided) ===
    if (subcategoryId && !mongoose.Types.ObjectId.isValid(subcategoryId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subcategoryId',
      });
    }

    // === Fetch category (lean for performance) ===
    const category = await Category.findById(categoryId)
      .select('name')
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // === Validate subcategory relationship (if provided) ===
    if (subcategoryId) {
      const subcategory = await SubCategory.findOne({
        _id: subcategoryId,
        categoryId: categoryId,
      }).lean();

      if (!subcategory) {
        return res.status(400).json({
          success: false,
          error: 'Subcategory does not belong to the specified category',
        });
      }
    }

    // === Upload all images to Cloudinary in parallel (fast & clean) ===
    const uploadPromises = req.files.map(async (file) => {
      const timestamp = Date.now();
      const sanitizedName = file.originalname
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .substring(0, 50);

      const publicId = `product_${seller._id}_${timestamp}_${sanitizedName}`;

      const result = await uploadFromStream(file.buffer || file.stream, {
        folder: 'products/images',
        resourceType: 'image',
        publicId,
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
        tags: ['product', `seller_${seller._id}`, 'pending'],
        context: `seller=${seller._id}|product_pending=true`,
        invalidate: true,
      });

      return result.secure_url;
    });

    const images = await Promise.all(uploadPromises);

    // === Generate product ID ===
    const productId = generateProductId();

    // === Common product data ===
    const productCommonData = {
      ...productData,
      productId,
      productStatus: 'pending',
      category: categoryId,
      subcategory: subcategoryId || undefined,
      seller: seller._id,
      images,
      brandArtist,
      isApproved: true,
    };

    // === Create product with all provided fields ===
    // Since we flattened the schema, we can just pass the data directly.
    // The Product model now contains all possible fields (height, width, clayType, etc.)
    const product = new Product(productCommonData);

    const savedProduct = await product.save();

    // Schedule auto-approval (if you still use agenda)
    await agenda.schedule('in 10 minutes', 'approve product', {
      _id: savedProduct._id,
    });

    // Sync to Algolia
    try {
      await syncProduct.syncProductsToAlgolia();
    } catch (syncError) {
      console.error('Algolia sync failed:', syncError);
      // Don't fail the whole request because of search index
    }

    return res.status(201).json({
      success: true,
      message: 'Product added successfully and images uploaded to Cloudinary',
      data: savedProduct,
    });
  } catch (error) {
    console.error('createProduct error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message,
    });
  }
};

const getSellerProducts = async (req, res) => {
  try {
    const seller = req.seller;

    if (!seller || !seller.isVerified) {
      return res.status(403).json({
        message: 'Unauthorized: Only verified sellers can access their products'
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const sellerData = await User.findById(seller._id).select(
      'firstName lastName'
    );

    if (!sellerData) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    const result = await Product.aggregate([
      { $match: { seller: seller._id } },
      {
        $facet: {
          products: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ]);

    const products = result[0].products;
    const total = result[0].totalCount[0]?.count || 0;

    if (products.length === 0) {
      return res
        .status(200)
        .json({ success: true, message: 'No products found for this seller' });
    }

    const formattedProducts = products.map((product) => {
      const previousPrice = product.previousPrice || product.regularPrice;
      const regularPrice = product.regularPrice;
      let discountOff = 0;

      if (regularPrice < previousPrice) {
        discountOff = ((previousPrice - regularPrice) / previousPrice) * 100;
        discountOff = parseFloat(discountOff.toFixed(2));
      }

      return {
        _id: product._id,
        productId: product.productId,
        productName: product.productName,
        inStock: product.inStock,
        brandArtist: product.brandArtist,
        regularPrice: product.regularPrice,
        previousPrice: previousPrice,
        discountOff: discountOff,
        productStatus: product.productStatus,
        isVisible: product.isVisible,
        images: product.images
      };
    });

    res.status(200).json({
      success: true,
      data: formattedProducts,
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const filterProducts = async (req, res) => {
  const seller = req.seller;

  if (!seller) {
    return res.status(403).json({
      message: 'Unauthorized: Only sellers can access their products'
    });
  }

  try {
    const {
      category,
      subcategory,
      brandArtist,
      minPrice,
      maxPrice,
      keyword,
      sortBy,
      page,
      limit
    } = req.query;

    let filter = { seller: seller._id };
    if (category) {
      filter.category = category;
    }

    if (subcategory) {
      filter.subcategory = subcategory;
    }

    if (brandArtist) {
      filter.brandArtist = brandArtist;
    }

    if (minPrice) {
      filter.price = {
        ...filter.price,
        $gte: Number(minPrice)
      };
    }

    if (maxPrice) {
      filter.price = {
        ...filter.price,
        $lte: Number(maxPrice)
      };
    }

    if (minPrice) {
      filter.salesPrice = {
        ...filter.salesPrice,
        $gte: Number(minPrice)
      };
    }

    if (maxPrice) {
      filter.salesPrice = {
        ...filter.salesPrice,
        $lte: Number(maxPrice)
      };
    }

    if (keyword) {
      filter.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } }
      ];
    }

    let sort = {};
    if (sortBy === 'price_asc') {
      sort.salesPrice = 1;
    } else if (sortBy === 'price_desc') {
      sort.salesPrice = -1;
    } else if (sortBy === 'newest') {
      sort.createdAt = -1;
    } else if (sortBy === 'oldest') {
      sort.createdAt = 1;
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const itemsPerPage = Math.max(1, parseInt(limit, 10) || 10);

    const result = await Product.aggregate([
      { $match: filter },
      { $sort: sort },
      {
        $facet: {
          products: [
            { $skip: (currentPage - 1) * itemsPerPage },
            { $limit: itemsPerPage }
          ],
          totalCount: [{ $count: 'count' }]
        }
      }
    ]);

    const products = result[0]?.products || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        currentPage,
        totalPages: Math.ceil(total / itemsPerPage)
      }
    });
  } catch (error) {
    res.status(500).json({
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

    const product = await Product.findOne({ _id: id });
    if (!product) {
      return res
        .status(404)
        .json({ message: 'Product not found or not approved' });
    }

    const previousPrice = product.previousPrice || product.regularPrice;
    const regularPrice = product.regularPrice;
    let discountOff = 0;

    if (regularPrice < previousPrice) {
      discountOff = ((previousPrice - regularPrice) / previousPrice) * 100;
      discountOff = parseFloat(discountOff.toFixed(2));
    }

    const formattedProduct = {
      ...product.toObject(),
      previousPrice: previousPrice,
      discountOff: discountOff.toFixed(2)
    };

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Product fetched successfully',
      data: formattedProduct
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

    const { deleteImages, regularPrice, ...productData } = req.body;

    const seller = req.seller;
    if (!seller || !seller.isVerified) {
      return res
        .status(403)
        .json({ message: 'Only verified sellers can update products' });
    }

    let product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (product.seller.toString() !== seller._id.toString()) {
      return res
        .status(403)
        .json({ message: 'You can only update your own products' });
    }

    let images = product.images || [];

    // Handle image deletions
    if (deleteImages && Array.isArray(deleteImages)) {
      images = images.filter((img) => !deleteImages.includes(img));
    }

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file) => {
        try {
          const result = await uploadFromStream(file.buffer || file.stream, {
            folder: 'product_images',
            resource_type: 'image'
          });
          return result.secure_url;
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          throw new Error(`Failed to upload ${file.originalname}`);
        }
      });

      try {
        const uploadedImageUrls = await Promise.all(uploadPromises);
        images.push(...uploadedImageUrls);
      } catch (error) {
        return res.status(500).json({
          message: error.message,
          error: error.message
        });
      }

      // Replace deleted images with newly uploaded ones if applicable
      if (deleteImages && deleteImages.length > 0 && req.files.length > 0) {
        const numToReplace = Math.min(deleteImages.length, req.files.length);
        for (let i = 0; i < numToReplace; i++) {
          const indexToReplace = product.images.indexOf(deleteImages[i]);
          if (indexToReplace !== -1) {
            images[indexToReplace] = images.pop(); // Replace deleted image with the last uploaded image
          }
        }
      }
    }

    if (regularPrice !== undefined && regularPrice !== product.regularPrice) {
      product.previousPrice = product.regularPrice;
      product.regularPrice = regularPrice;
    }

    const updatedData = {
      ...productData,
      images,
      regularPrice: product.regularPrice,
      previousPrice: product.previousPrice
    };

    const category = product.category;
    let ModelToUpdate;
    switch (category) {
      case 'Sculpture':
        ModelToUpdate = Sculpture;
        break;

      case 'Textiles':

      case 'Textiles/Fabrics':
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
      data: updatedProduct
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  } finally {
    // No cleanup needed; removed undefined client reference
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

const toggleProductVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVisible } = req.body;

    if (typeof isVisible !== 'boolean') {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Invalid value for isVisible. It must be true or false.'
      });
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { isVisible },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        status: 404,
        success: false,
        message: 'Product not found'
      });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: `Product visibility updated successfully`
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

const searchProducts = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Search query "q" is required.'
      });
    }

    const { hits } = await productIndex.search(q);

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Products fetched successfully',
      data: hits
    });
  } catch (error) {
    console.error('Algolia search error:', error);
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error during product search',
      error: error.message
    });
  }
};

module.exports = {
  createProduct,
  getSellerProducts,
  filterProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleProductVisibility,
  searchProducts
};



