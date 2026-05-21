const mongoose = require('mongoose');
const Seller = require('../models/sellerModel');
const { Product } = require('../models/productModel');
const { getFxRateNGNtoUSD } = require('../Buyer/Service/adminControlledFxService');

const PUBLIC_FIELDS = 'firstName lastName profilePicture country isVerified sellerStatus businessType corporateBusinessAccount.companyName storeProfile createdAt';

async function resolveSeller(identifier) {
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const byId = await Seller.findById(identifier).select(PUBLIC_FIELDS).lean();
    if (byId) return byId;
  }
  return Seller.findOne({ 'storeProfile.storeName': identifier.toLowerCase() }).select(PUBLIC_FIELDS).lean();
}

module.exports.getSellerStore = async (req, res) => {
  try {
    const seller = await resolveSeller(req.params.identifier);
    if (!seller) {
      return res.status(404).json({ status: 404, success: false, message: 'Store not found' });
    }
    const productCount = await Product.countDocuments({ seller: seller._id, isVisible: true });
    return res.status(200).json({
      status: 200,
      success: true,
      body: { seller: { ...seller, productCount } },
    });
  } catch (error) {
    console.error('sellerPublicController.getSellerStore:', error);
    return res.status(500).json({ status: 500, success: false, message: error.message });
  }
};

module.exports.getSellerStoreProducts = async (req, res) => {
  try {
    const { skip = 0, limit = 12 } = req.query;

    const seller = await resolveSeller(req.params.identifier);
    if (!seller) {
      return res.status(404).json({ status: 404, success: false, message: 'Store not found' });
    }

    let fxRate = null;
    try { fxRate = await getFxRateNGNtoUSD(); } catch (_) {}

    const query = { seller: seller._id, isVisible: true };
    const [total, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .populate('category', 'name')
        .select('productName images regularPrice discountPrice productId productRating category productStatus seller')
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .lean(),
    ]);

    const enriched = products.map((p) => ({
      ...p,
      productImages: p.images,
      productPrice: p.regularPrice,
      regularPriceUSD: fxRate ? Number(((p.regularPrice || 0) * fxRate).toFixed(2)) : null,
      discountPriceUSD: fxRate && p.discountPrice ? Number((p.discountPrice * fxRate).toFixed(2)) : null,
      category: p.category?.name || '',
    }));

    return res.status(200).json({
      status: 200,
      success: true,
      body: { products: enriched, total, skip: parseInt(skip), limit: parseInt(limit) },
    });
  } catch (error) {
    console.error('sellerPublicController.getSellerStoreProducts:', error);
    return res.status(500).json({ status: 500, success: false, message: error.message });
  }
};

module.exports.updateStoreProfile = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { storeName, bannerImage, description, socialLinks } = req.body;

    if (storeName) {
      const slug = storeName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const existing = await Seller.findOne({ 'storeProfile.storeName': slug, _id: { $ne: sellerId } });
      if (existing) {
        return res.status(409).json({ status: 409, success: false, message: 'This store name is already taken. Please choose another.' });
      }
      req.body.storeName = slug;
    }

    const updateFields = {};
    if (req.body.storeName !== undefined) updateFields['storeProfile.storeName'] = req.body.storeName;
    if (bannerImage !== undefined) updateFields['storeProfile.bannerImage'] = bannerImage;
    if (description !== undefined) updateFields['storeProfile.description'] = description;
    if (socialLinks) {
      ['instagram', 'twitter', 'facebook', 'tiktok', 'website'].forEach((k) => {
        if (socialLinks[k] !== undefined) updateFields[`storeProfile.socialLinks.${k}`] = socialLinks[k];
      });
    }

    const seller = await Seller.findByIdAndUpdate(sellerId, { $set: updateFields }, { new: true, runValidators: true })
      .select('storeProfile firstName lastName').lean();

    if (!seller) {
      return res.status(404).json({ status: 404, success: false, message: 'Seller not found' });
    }

    return res.status(200).json({ status: 200, success: true, message: 'Store profile updated', body: { storeProfile: seller.storeProfile } });
  } catch (error) {
    console.error('sellerPublicController.updateStoreProfile:', error);
    return res.status(500).json({ status: 500, success: false, message: error.message });
  }
};
