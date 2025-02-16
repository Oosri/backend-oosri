const { Product, Sculpture, Textiles, Pottery, Jewelry, Paintings } = require('../models/productModel');
const Category = require('../models/categoryModel'); 
const ftpClient = require('basic-ftp');
const { Readable } = require('stream');
const path = require('path');
const User = require("../models/sellerModel");
const agenda = require('../configs/agenda');



const generateProductId = () => {
  const chars = "0123456789";
  let productId = "";
  for (let i = 0; i < 8; i++) {
    productId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return productId;
};

const createProduct = async (req, res) => {
  const client = new ftpClient.Client();
  client.ftp.verbose = true;

  try {
    const { category, subcategory, brandArtist, ...productData } = req.body;


    

    const seller = req.seller;

    if (!seller || !seller.isVerified) {
      return res.status(403).json({ message: "Only verified sellers can add products" });
    }

    if (!brandArtist) {
      return res.status(400).json({ error: "Brand artist is required" });
    }


    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    // if (!req.files || req.files.length === 0) {
    //   return res.status(400).json({ error: 'No files uploaded' });
    // }


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
    const productId = generateProductId(); 

    const productCommonData = {
      ...productData,
      productId,
      productStatus: "pending", 
      category,
      subcategory,
      seller: seller._id,
      images,
      brandArtist,
      isApproved: false,
    };

    switch (category) {
      case "Sculpture":
        product = new Sculpture({

          ...productCommonData,

          ...productData,
          category,
          subcategory,
          seller: seller._id,
          images,
          brandArtist,
          status: 'Active',

          height: productData.height,
          width: productData.width,
          weight: productData.weight,
          technique: productData.technique,
        });
        break;


      case "Textiles":
        product = new Textiles({
          ...productCommonData,
          yard: productData.yard,

      case 'Textiles/Fabrics':
        product = new Textiles({
          ...productData,
          category,
          subcategory,
          seller: seller._id,
          images,
          brandArtist,
          status: 'Active',
          length: productData.length,
          width: productData.width,

          weight: productData.weight,
          fabricType: productData.fabricType,
          pattern: productData.pattern,
        });
        break;

      case "Pottery":
        product = new Pottery({

          ...productCommonData,

          ...productData,
          category,
          subcategory,
          seller: seller._id,
          images,
          brandArtist,
          status: 'Active',

          height: productData.height,
          diameter: productData.diameter,
          clayType: productData.clayType,
          glaze: productData.glaze,
        });
        break;

      case "Jewelry":
        product = new Jewelry({

          ...productCommonData,

          ...productData,
          category,
          subcategory,
          seller: seller._id,
          images,
          brandArtist,
          status: 'Active',

          length: productData.length,
          diameter: productData.diameter,
          stoneType: productData.stoneType,
          metalType: productData.metalType,
        });
        break;

      case "Paintings":
        product = new Paintings({

          ...productCommonData,

          ...productData,
          category,
          subcategory,
          seller: seller._id,
          images,
          brandArtist,
          status: 'Active',

          medium: productData.medium,
          condition: productData.condition,
          size: productData.size,
          dimension: productData.dimension,
        });
        break;

      default:
        return res.status(400).json({ error: "Unsupported category" });
    }

    const savedProduct = await product.save(); 

    await agenda.schedule("in 10 minutes", "approve product", { _id: savedProduct._id });


    return res.status(201).json({
      status: 201,
      success: true,
      message: "Product added successfully.",
      data: product,
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    client.close();
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
    const sellerData = await User.findById(seller._id).select("firstName lastName");

    if (!sellerData) {
      return res.status(404).json({ message: "Seller not found" });
    }

    const sellerName = `${sellerData.firstName} ${sellerData.lastName}`;

    const result = await Product.aggregate([
      { $match: { seller: seller._id } },
      {
        $facet: {
          products: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ]);

    const products = result[0].products;
    const total = result[0].totalCount[0]?.count || 0;

    if (products.length === 0) {
      return res.status(200).json({ success: true, message: 'No products found for this seller' });
    }

    const formattedProducts = products.map(product => {
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
        inStock: product.inStock,
        sellerName: sellerName,
        regularPrice: product.regularPrice,
        previousPrice: previousPrice,
        discountOff: discountOff,
        productStatus: product.productStatus
      };
    });

    res.status(200).json({
      success: true,
      data: formattedProducts,
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

const filterProducts = async (req, res) => {
  const seller = req.seller;

  if (!seller) {
    return res
      .status(403)
      .json({ message: 'Unauthorized: Only sellers can access their products' });
  }

  try {
    const { category, subcategory, brandArtist, minPrice, maxPrice, keyword, sortBy, page, limit } = req.query;

    let filter = { seller: seller._id };
    if (category) {
      filter.category = category
    };

    if (subcategory) {
      filter.subcategory = subcategory
    };

    if (brandArtist) {
      filter.brandArtist = brandArtist
    };

    if (minPrice) {
      filter.price = { 
        ...filter.price, $gte: Number(minPrice) 
      }
    };

    if (maxPrice) {
      filter.price = { 
        ...filter.price, $lte: Number(maxPrice) 
      }
    };

    if (keyword) {
      filter.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
      ];
    }

    let sort = {};
    if (sortBy === 'price_asc') {
      sort.price = 1;
    } else if (sortBy === 'price_desc') {
      sort.price = -1;
    } else if (sortBy === 'newest') {
      sort.createdAt = -1;
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
            { $limit: itemsPerPage },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ]);

    const products = result[0]?.products || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        currentPage,
        totalPages: Math.ceil(total / itemsPerPage),
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message,
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
      discountOff: discountOff.toFixed(2),
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
  const client = new ftpClient.Client();
  client.ftp.verbose = true;

  try {
    const { id } = req.params;

    const { deleteImages, regularPrice, ...productData } = req.body; 

    const { deleteImages, ...productData } = req.body;


    const seller = req.seller;
    if (!seller || !seller.isVerified) {
      return res.status(403).json({ message: "Only verified sellers can update products" });
    }

    let product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (product.seller.toString() !== seller._id.toString()) {
      return res.status(403).json({ message: "You can only update your own products" });
    }

    let images = product.images || [];

    // Handle image deletions
    if (deleteImages && Array.isArray(deleteImages)) {
      images = images.filter((img) => !deleteImages.includes(img));
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
      previousPrice: product.previousPrice,
    };

    const category = product.category;
    let ModelToUpdate;
    switch (category) {
      case "Sculpture":
        ModelToUpdate = Sculpture;
        break;

      case "Textiles":

      case 'Textiles/Fabrics':

        ModelToUpdate = Textiles;
        break;
      case "Pottery":
        ModelToUpdate = Pottery;
        break;
      case "Jewelry":
        ModelToUpdate = Jewelry;
        break;
      case "Paintings":
        ModelToUpdate = Paintings;
        break;
      default:
        return res.status(400).json({ error: "Unsupported category" });
    }

    const updatedProduct = await ModelToUpdate.findByIdAndUpdate(
      id,
      { $set: updatedData },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Failed to update product" });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: "Internal server error",
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

const toggleProductVisibility = async (req, res) => {
  try {
    const { id } = req.params; 
    const { isVisible } = req.body; 

    if (typeof isVisible !== "boolean") {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Invalid value for isVisible. It must be true or false.",
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
        message: "Product not found",
      });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: `Product visibility updated successfully`,
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: "Internal server error",
      error: error.message,
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
};
