const Order = require('../Buyer/models/buyerOrderModel');
const mongoose = require('mongoose');

const listOrders = async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const { page = 1, limit = 10, year, search } = req.query;

    const query = {
      'products.sellerId': new mongoose.Types.ObjectId(sellerId)
    };

    if (year) {
      const startDate = new Date(parseInt(year), 0, 1);
      const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59);
      query.orderDate = { $gte: startDate, $lte: endDate };
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { orderId: searchRegex },
        { 'products.productName': searchRegex }
      ];
    }

    const orders = await Order.find(query)
      .populate('userId', 'fullName')
      .sort({ orderDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .exec();

    // Filter products to only show those belonging to the seller for each order
    const ordersForSeller = orders.map((order) => {
      const sellerProducts = order.products.filter(
        (p) => p.sellerId.toString() === sellerId.toString()
      );
      return {
        ...order.toObject(),
        products: sellerProducts,
        totalForSeller: sellerProducts.reduce((acc, p) => acc + (p.totalPrice || 0), 0)
      };
    });

    const count = await Order.countDocuments(query);

    return res.status(200).json({
      status: 200,
      success: true,
      data: ordersForSeller,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page)
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

const getOrderDetails = async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const { id } = req.params;

    // Validate if the provided ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: 'Invalid Order ID format.'
      });
    }

    const order = await Order.findOne({
      _id: id,
      'products.sellerId': new mongoose.Types.ObjectId(sellerId)
    })
      .populate('userId', 'fullName email phoneNumber')
      .populate('products.productId');

    if (!order) {
      return res.status(404).json({
        message: 'Order not found or you do not have permission to view it.'
      });
    }

    const sellerProducts = order.products.filter(
      (p) => p.sellerId.toString() === sellerId.toString()
    );
    const orderForSeller = {
      ...order.toObject(),
      products: sellerProducts,
      totalForSeller: sellerProducts.reduce((acc, p) => acc + (p.totalPrice || 0), 0)
    };

    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Order details fetched successfully.',
      data: orderForSeller
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

module.exports = { listOrders, getOrderDetails };
