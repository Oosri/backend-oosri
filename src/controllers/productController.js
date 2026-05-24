const {
  Product
} = require('../models/productModel');
const { Category, SubCategory } = require('../models/categoryModel');
const mongoose = require('mongoose');
const BuyerProductReview = require('../Buyer/models/buyerProductReviewModel');
// const ftpClient = require('basic-ftp'); // removed: not used
const { Readable } = require('stream');
const path = require('path');
const User = require('../models/sellerModel');
const agenda = require('../configs/agenda');
const syncProduct = require('../Buyer/Service/buyerProductService');
const redis = require('../configs/redis');
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
  uploadFromStream,
  generateProductPresignedUrl,
  validateCloudinaryUrl
} = require('../utils/cloudinarySignature'); // Updated import
const { cloudinary } = require('../utils/cloudinary'); // adjust path as needed

const getUploadUrl = async (req, res) => {
  try {
    const seller = req.seller;
    if (!seller || !seller.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Only verified sellers can upload images'
      });
    }

    const { fileName } = req.query;
    const signatureData = generateProductPresignedUrl(seller._id, fileName);

    return res.status(200).json({
      success: true,
      data: signatureData
    });
  } catch (error) {
    console.error('getUploadUrl error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate upload URL',
      error: error.message
    });
  }
};

/**
 * Validates dynamic attributes against the category's attribute schema
 * @param {Object} attributeValues - Key-value pair of attributes from request
 * @param {Array} categoryAttributes - Array of attribute definitions from Category model
 * @returns {Array} errors - Array of error messages, empty if valid
 */
const validateDynamicAttributes = async (attributeValues, categoryAttributes) => {
  const errors = [];
  const Attribute = require('../models/attributeModel').Attribute;

  // Create a map for quick lookup of category configuration
  const categoryAttrMap = new Map();
  categoryAttributes.forEach(attr => {
    if (attr.attributeId) {
      categoryAttrMap.set(attr.attributeId.toString(), attr);
    }
  });

  // Fetch full attribute definitions
  const attributeIds = categoryAttributes.map(a => a.attributeId);
  const fullAttributes = await Attribute.find({ _id: { $in: attributeIds } });
  const fullAttrMap = new Map();
  fullAttributes.forEach(attr => fullAttrMap.set(attr._id.toString(), attr));
  fullAttributes.forEach(attr => fullAttrMap.set(attr.code, attr)); // Also index by code

  // 1. Check Required Attributes
  for (const [id, config] of categoryAttrMap) {
    const fullAttr = fullAttrMap.get(id);
    if (!fullAttr) continue;

    // Check if value exists (using code as key in payload)
    const value = attributeValues[fullAttr.code];

    if (config.isRequired && (value === undefined || value === null || value === '')) {
      errors.push(`Attribute '${fullAttr.label}' (${fullAttr.code}) is required.`);
    }
  }

  // 2. Validate Values
  for (const [code, value] of Object.entries(attributeValues)) {
    // Skip validating type for empty values. The `isRequired` check above
    // acts as the gatekeeper for required fields. Optional fields should tolerate being empty.
    if (value === undefined || value === null || value === '') {
      continue;
    }

    const fullAttr = fullAttrMap.get(code);

    // If attribute is not in the system/category, we might choose to ignore or error.
    // For now, let's strictly allow only attributes defined in the category if we want strict schema,
    // OR allow flexible attributes. The plan implies strict validation against Category definition.
    // Let's find if this code belongs to the category.

    if (!fullAttr) {
      // Attribute code not found in system
      // errors.push(`Unknown attribute code: ${code}`); 
      continue;
    }

    const categoryConfig = categoryAttributes.find(ca =>
      ca.attributeId.toString() === fullAttr._id.toString()
    );

    if (!categoryConfig) {
      // Attribute exists but not assigned to this category
      // errors.push(`Attribute '${code}' is not valid for this category.`);
      continue;
    }

    // Type Validation
    if (fullAttr.type === 'number') {
      if (isNaN(Number(value))) {
        errors.push(`Attribute '${fullAttr.label}' must be a number.`);
      }
      if (fullAttr.validation) {
        if (fullAttr.validation.min !== undefined && Number(value) < fullAttr.validation.min) {
          errors.push(`Attribute '${fullAttr.label}' must be at least ${fullAttr.validation.min}.`);
        }
        if (fullAttr.validation.max !== undefined && Number(value) > fullAttr.validation.max) {
          errors.push(`Attribute '${fullAttr.label}' must be at most ${fullAttr.validation.max}.`);
        }
      }
    } else if (['select', 'multiselect'].includes(fullAttr.type)) {
      // Validate options
      const validOptions = fullAttr.options || [];
      if (fullAttr.type === 'select') {
        if (!validOptions.includes(value)) {
          errors.push(`Value '${value}' is not a valid option for '${fullAttr.label}'.`);
        }
      } else {
        // Multiselect (assuming array input)
        if (!Array.isArray(value)) {
          errors.push(`Attribute '${fullAttr.label}' must be an array of values.`);
        } else {
          const invalid = value.filter(v => !validOptions.includes(v));
          if (invalid.length > 0) {
            errors.push(`Invalid options for '${fullAttr.label}': ${invalid.join(', ')}`);
          }
        }
      }
    } else if (fullAttr.type === 'object') {
      if (typeof value !== 'object' || value === null) {
        errors.push(`Attribute '${fullAttr.label}' must be a valid JSON object.`);
      }
    } else if (fullAttr.type === 'rich_text') {
      if (typeof value !== 'string') {
        errors.push(`Attribute '${fullAttr.label}' must be a string.`);
      }
    }
  }

  return errors;
};

const createProduct = async (req, res) => {
  try {
    const { categoryId, subcategoryId, brandArtist, images: imageUrls, ...productData } = req.body;
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

    // Validate images
    const images = Array.isArray(imageUrls) ? imageUrls : [];
    if (images.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one product image is required',
      });
    }

    // Validate image URLs are from our Cloudinary account
    const invalidImages = images.filter(url => !validateCloudinaryUrl(url));
    if (invalidImages.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid image URLs detected',
        invalidImages
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

    // === Fetch category (populated for attributes) ===
    const category = await Category.findById(categoryId)
      .select('name attributes')
      .lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
      });
    }

    // === Validate Dynamic Attributes ===
    // We expect dynamic attributes in req.body.attributes
    // If legacy fields are passed (e.g. technique), they act as fallbacks/overrides but 
    // for validation we look at the new `attributes` map if it exists.

    let providedAttributes = productData.attributes || {};

    // For backward compatibility, if specific fields are passed in root, add them to attributes
    // This is optional but helps migration. 
    // For now, we strictly check `attributes` field to separate concerns as per plan.

    if (category.attributes && category.attributes.length > 0) {
      const attributeErrors = await validateDynamicAttributes(providedAttributes, category.attributes);
      if (attributeErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Attribute validation failed',
          details: attributeErrors
        });
      }
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

    // === Generate product ID ===
    const productId = generateProductId();

    // === Handle Pricing & Discount logic ===
    let { regularPrice, discount, discountPrice } = productData;
    regularPrice = Number(regularPrice) || 0;
    
    // If discount percentage is provided but no discountPrice, compute discountPrice
    if (discount && discount > 0 && !discountPrice) {
      discountPrice = regularPrice * (1 - discount / 100);
    } 
    // If discountPrice is provided, compute percentage
    else if (discountPrice && discountPrice > 0 && discountPrice < regularPrice) {
      discount = ((regularPrice - discountPrice) / regularPrice) * 100;
    } else {
      discountPrice = null;
      discount = 0;
    }

    const sellerPayout = Number(((discountPrice || regularPrice) * 0.85).toFixed(2));

    // === Common product data ===
    const productCommonData = {
      ...productData,
      regularPrice,
      discount,
      discountPrice,
      sellerPayout,
      productId,
      productStatus: 'approved',
      isApproved: true,
      category: categoryId,
      subcategory: subcategoryId || undefined,
      seller: seller._id,
      images,
      brandArtist,
      // Ensure units are captured if provided
      weightUnit: productData.weightUnit || 'kg',
      dimensions: {
        ...productData.dimensions,
        unit: productData.dimensions?.unit || 'cm'
      },
      attributes: providedAttributes // Save the validated dynamic map
    };

    // === Create product with all provided fields ===
    const product = new Product(productCommonData);

    const savedProduct = await product.save();

    // Schedule auto-approval (if you still use agenda)
    await agenda.schedule('in 10 minutes', 'approve product', {
      _id: savedProduct._id,
    });

    // Clear seller's product cache and buyer listing cache
    try {
      const sellerKeys = await redis.keys(`seller_products_${seller._id}_*`);
      const buyerKeys  = await redis.keys('products:list:*');
      const allKeys = [...sellerKeys, ...buyerKeys];
      if (allKeys.length > 0) await redis.del(allKeys);
    } catch (cacheError) {
      console.error('Cache invalidation error:', cacheError);
    }

    // Sync to Algolia - Incremental
    try {
      await syncProduct.syncProductsToAlgolia(savedProduct);
    } catch (syncError) {
      console.error('Algolia sync failed:', syncError);
    }

    return res.status(201).json({
      success: true,
      message: 'Product added successfully',
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
      let discountOff = product.discount || 0;
      let discountPrice = product.discountPrice || null;

      if (!discountPrice && regularPrice < previousPrice) {
        discountOff = ((previousPrice - regularPrice) / previousPrice) * 100;
        discountOff = parseFloat(discountOff.toFixed(2));
      }

      const effectivePrice = discountPrice || regularPrice;
      const sellerPayout = Number((effectivePrice * 0.85).toFixed(2));

      return {
        _id: product._id,
        productId: product.productId,
        productName: product.productName,
        inStock: product.inStock,
        brandArtist: product.brandArtist,
        regularPrice: product.regularPrice,
        discountPrice: discountPrice,
        sellerPayout: sellerPayout,
        previousPrice: previousPrice,
        discountOff: discountOff,
        productStatus: product.productStatus,
        isVisible: product.isVisible,
        images: product.images
      };
    });

    const responseData = {
      success: true,
      data: formattedProducts,
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit)
      }
    };

    // Cache the results
    try {
      await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 3600);
    } catch (cacheError) {
      console.error('Cache set error:', cacheError);
    }

    res.status(200).json(responseData);
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

    const formattedProducts = products.map((product) => {
      const previousPrice = product.previousPrice || product.regularPrice;
      const regularPrice = product.regularPrice;
      let discountOff = product.discount || 0;
      let discountPrice = product.discountPrice || null;

      if (!discountPrice && regularPrice < previousPrice) {
        discountOff = ((previousPrice - regularPrice) / previousPrice) * 100;
        discountOff = parseFloat(discountOff.toFixed(2));
      }

      const effectivePrice = discountPrice || regularPrice;
      const sellerPayout = Number((effectivePrice * 0.85).toFixed(2));

      return {
        _id: product._id,
        productId: product.productId,
        productName: product.productName,
        inStock: product.inStock,
        brandArtist: product.brandArtist,
        regularPrice: product.regularPrice,
        discountPrice: discountPrice,
        sellerPayout: sellerPayout,
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
    const cacheKey = `product_${id}`;

    try {
      const cachedProduct = await redis.get(cacheKey);
      if (cachedProduct) {
        return res.status(200).json({
          status: 200,
          success: true,
          message: 'Product fetched from cache',
          data: JSON.parse(cachedProduct)
        });
      }
    } catch (cacheError) {
      console.error('Cache fetch error:', cacheError);
    }

    const product = await Product.findOne({ _id: id }).populate({
      path: 'category',
      populate: {
        path: 'attributes.attributeId',
        model: 'Attribute'
      }
    });
    if (!product) {
      return res
        .status(404)
        .json({ message: 'Product not found or not approved' });
    }

    const previousPrice = product.previousPrice || product.regularPrice;
    const regularPrice = product.regularPrice;
    let discountOff = product.discount || 0;
    let discountPrice = product.discountPrice || null;

    if (!discountPrice && regularPrice < previousPrice) {
      discountOff = ((previousPrice - regularPrice) / previousPrice) * 100;
      discountOff = parseFloat(discountOff.toFixed(2));
    }

    const effectivePrice = discountPrice || regularPrice;
    const sellerPayout = Number((effectivePrice * 0.85).toFixed(2));

    const formattedProduct = {
      ...product.toObject(),
      previousPrice: previousPrice,
      discountOff: discountOff.toFixed(2),
      discountPrice: discountPrice,
      sellerPayout: sellerPayout
    };

    // Store in cache
    try {
      await redis.set(cacheKey, JSON.stringify(formattedProduct), 'EX', 3600);
    } catch (cacheError) {
      console.error('Cache set error:', cacheError);
    }

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

    const {
      deleteImages,
      regularPrice,
      images: newImages,
      replaceImages,
      categoryId,
      subcategoryId,
      ...productData
    } = req.body;

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

    // Handle new images (direct URLs)
    if (newImages && Array.isArray(newImages)) {
      // Validate URLs
      const invalidImages = newImages.filter(url => !validateCloudinaryUrl(url));
      if (invalidImages.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid image URLs detected in update',
          invalidImages
        });
      }

      if (replaceImages) {
        images = newImages; // Full replacement
      } else {
        images.push(...newImages); // Append
      }
    }

    if (images.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one product image is required'
      });
    }

    let resolvedCategoryId = product.category?.toString();
    if (categoryId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({
          success: false,
          error: 'Valid categoryId is required'
        });
      }

      const category = await Category.findById(categoryId).select('attributes').lean();
      if (!category) {
        return res.status(404).json({
          success: false,
          error: 'Category not found'
        });
      }

      resolvedCategoryId = categoryId;
    }

    let resolvedSubcategoryId =
      subcategoryId === null || subcategoryId === ''
        ? undefined
        : subcategoryId || product.subcategory?.toString();

    if (resolvedSubcategoryId && !mongoose.Types.ObjectId.isValid(resolvedSubcategoryId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subcategoryId'
      });
    }

    if (resolvedSubcategoryId) {
      const subcategory = await SubCategory.findOne({
        _id: resolvedSubcategoryId,
        categoryId: resolvedCategoryId,
      }).lean();

      if (!subcategory) {
        return res.status(400).json({
          success: false,
          error: 'Subcategory does not belong to the specified category'
        });
      }
    }

    let finalRegularPrice = regularPrice !== undefined ? Number(regularPrice) : product.regularPrice;
    let { discount, discountPrice } = productData;
    
    // Convert to numbers if provided
    if (discount !== undefined) discount = Number(discount);
    if (discountPrice !== undefined) discountPrice = Number(discountPrice) || null;

    // Standardize logic
    if (discountPrice && discountPrice > 0 && discountPrice < finalRegularPrice) {
      discount = ((finalRegularPrice - discountPrice) / finalRegularPrice) * 100;
    } else if (discount && discount > 0 && !discountPrice) {
      discountPrice = finalRegularPrice * (1 - discount / 100);
    } else if (discountPrice === null || discountPrice === '' || discountPrice === 0) {
      discountPrice = null;
      discount = 0;
    }

    if (regularPrice !== undefined && regularPrice !== product.regularPrice) {
      product.previousPrice = product.regularPrice;
      product.regularPrice = finalRegularPrice;
    }

    const effectiveDiscountPrice = discountPrice !== undefined ? discountPrice : product.discountPrice;
    const sellerPayout = Number(((effectiveDiscountPrice || product.regularPrice) * 0.85).toFixed(2));

    const updatedData = {
      ...productData,
      images,
      regularPrice: product.regularPrice,
      previousPrice: product.previousPrice,
      discount: discount !== undefined ? discount : product.discount,
      discountPrice: discountPrice !== undefined ? discountPrice : product.discountPrice,
      sellerPayout,
      // Handle units update
      weightUnit: productData.weightUnit || product.weightUnit,
      dimensions: {
        ...(product.dimensions ? product.dimensions.toObject() : {}),
        ...productData.dimensions,
        unit: productData.dimensions?.unit || product.dimensions?.unit || 'cm'
      },
      category: resolvedCategoryId,
      subcategory: resolvedSubcategoryId
    };

    // === Handle Dynamic Attributes Update ===
    if (productData.attributes || categoryId !== undefined) {
      const category = await Category.findById(resolvedCategoryId).select('attributes').lean();
      const existingAttrs = product.attributes ? Object.fromEntries(product.attributes) : {};
      const mergedAttrs = {
        ...existingAttrs,
        ...(productData.attributes || {})
      };

      if (category && category.attributes && category.attributes.length > 0) {
        const attributeErrors = await validateDynamicAttributes(mergedAttrs, category.attributes);
        if (attributeErrors.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Attribute validation failed',
            details: attributeErrors
          });
        }
      }

      updatedData.attributes = mergedAttrs;
    }

    // Reset low-stock alert flag if seller has restocked above threshold
    const newInStock = productData.inStock !== undefined ? Number(productData.inStock) : product.inStock;
    const threshold = productData.lowStockThreshold !== undefined
      ? Number(productData.lowStockThreshold)
      : (product.lowStockThreshold ?? 5);
    if (newInStock > threshold && product.lowStockAlertSent) {
      updatedData.lowStockAlertSent = false;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updatedData },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Failed to update product' });
    }

    // Incremental Sync to Algolia
    try {
      await syncProduct.syncProductsToAlgolia(updatedProduct);
    } catch (syncError) {
      console.error('Algolia sync failed on update:', syncError);
    }

    // Clear caches
    try {
      const sellerKeys = await redis.keys(`seller_products_${seller._id}_*`);
      const buyerKeys  = await redis.keys('products:list:*');
      const allKeys = [`product_${id}`, ...sellerKeys, ...buyerKeys];
      await redis.del(allKeys);
    } catch (cacheError) {
      console.error('Cache invalidation error on update:', cacheError);
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

    // Clear caches
    try {
      await redis.del(`product_${id}`);
      const cachePattern = `seller_products_${seller._id}_*`;
      const keys = await redis.keys(cachePattern);
      if (keys.length > 0) await redis.del(keys);
    } catch (cacheError) {
      console.error('Cache invalidation error on delete:', cacheError);
    }

    // Remove from Algolia
    try {
      await syncProduct.removeProductFromAlgolia(id);
    } catch (syncError) {
      console.error('Algolia removal failed:', syncError);
    }

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

    // Sync visibility change to Algolia
    try {
      await syncProduct.syncProductsToAlgolia(product);
    } catch (syncError) {
      console.error('Algolia sync failed on visibility toggle:', syncError);
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

    const formattedHits = hits.map((product) => {
      const regularPrice = product.regularPrice || product.price || 0;
      const discountPrice = product.discountPrice || null;
      const effectivePrice = discountPrice || regularPrice;
      const sellerPayout = Number((effectivePrice * 0.85).toFixed(2));

      return {
        ...product,
        _id: product.objectID,
        regularPrice: regularPrice,
        discountPrice: discountPrice,
        sellerPayout: sellerPayout,
        inStock: product.inStock ?? product.quantity ?? 0,
        isVisible: product.isApproved ?? product.isVisible ?? false
      };
    });

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Products fetched successfully',
      data: formattedHits
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

const getProductReviewsForSeller = async (req, res) => {
  try {
    const { id } = req.params;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      BuyerProductReview.find({ productId: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BuyerProductReview.countDocuments({ productId: id }),
    ]);

    return res.status(200).json({
      status: 200,
      message: 'Reviews fetched',
      body: {
        reviews: reviews.map((r) => ({
          id: r._id,
          reviewer: r.reviewer,
          reviewerEmail: r.reviewerEmail,
          review: r.review,
          productRating: r.productRating,
          reviewDate: r.reviewDate,
          status: r.status,
        })),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          pageSize: limit,
          total,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ status: 500, message: error.message });
  }
};

module.exports = {
  createProduct,
  getUploadUrl,
  getSellerProducts,
  filterProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleProductVisibility,
  searchProducts,
  getProductReviewsForSeller,
};
