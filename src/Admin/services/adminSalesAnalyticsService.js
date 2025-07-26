const Order = require('../../Buyer/models/buyerOrderModel');
const moment = require('moment');




module.exports ={
   

 retrieveOrderStat: async () => {
  try {
   const startOfYear = moment().startOf('year').toDate();
    const endOfYear = moment().endOf('year').toDate();

    const allOrders = await Order.find({
      orderDate: { $gte: startOfYear, $lte: endOfYear }
    });

    if (!allOrders || allOrders.length === 0) {
      return {
        totalEarnings: 0,
        totalOrders: 0,
        weeklyEarnings: 0,
        monthlyEarnings: {},
      };
    }

    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    let totalEarnings = 0.0;
    let weeklyEarnings = 0.0;
    const monthlyEarnings = {
      jan: 0.0, feb: 0.0, mar: 0.0, apr: 0.0, may: 0.0, jun: 0.0,
      jul: 0.0, aug: 0.0, sep: 0.0, oct: 0.0, nov: 0.0, dec: 0.0
    };

    const currentWeekStart = moment().startOf('week');
    const currentWeekEnd = moment().endOf('week');

    allOrders.forEach(order => {
      const orderDate = moment(order.orderDate);
      const deliveryFee = order.deliveryFee || 0;
      const orderTotal = +order.totalAmount + deliveryFee;

      totalEarnings += orderTotal;

      if (orderDate.isBetween(currentWeekStart, currentWeekEnd, null, '[]')) {
        weeklyEarnings += orderTotal;
      }

      const monthIndex = orderDate.month();
      const monthName = monthNames[monthIndex];
      monthlyEarnings[monthName] += orderTotal;
    });

    return {
      totalEarnings,
      totalOrders: allOrders.length,
      weeklyEarnings,
      monthlyEarnings
    };

  } catch (error) {
    console.log('Something went wrong: Service: retrieveOrderStat', error);
    throw new Error(error.message);
  }
},


  retrieveProductSalesAnalytics : async (filters = {}) => {
  try {
    let startDate = null;
    let endDate = null;

    switch (filters.dateFilter) {
      case 'thisWeek':
        startDate = moment().startOf('week');
        endDate = moment().endOf('week');
        break;
      case 'lastWeek':
        startDate = moment().subtract(1, 'weeks').startOf('week');
        endDate = moment().subtract(1, 'weeks').endOf('week');
        break;
      case 'thisMonth':
        startDate = moment().startOf('month');
        endDate = moment().endOf('month');
        break;
      case 'lastMonth':
        startDate = moment().subtract(1, 'months').startOf('month');
        endDate = moment().subtract(1, 'months').endOf('month');
        break;
      case 'thisYear':
        startDate = moment().startOf('year');
        endDate = moment().endOf('year');
        break;
      case 'lastYear':
        startDate = moment().subtract(1, 'years').startOf('year');
        endDate = moment().subtract(1, 'years').endOf('year');
        break;
    }

    const query = {};
    if (startDate && endDate) {
      query.orderDate = { $gte: startDate.toDate(), $lte: endDate.toDate() };
    }

    const allOrders = await Order.find(query)
      .populate({
        path: 'products.productId',
        select: 'productName images',
      })
      .populate({
        path: 'products.sellerId',
        select: 'firstName lastName profilePicture',
      });

    const productSalesMap = new Map();
    const sellerSalesMap = new Map();

    allOrders.forEach(order => {
      order.products.forEach(item => {
        const { productId, price, totalPrice, sellerId } = item;

        const quantity = item.quantity || Math.round(totalPrice / (price || 1));

        if (productId) {
          const productKey = productId._id?.toString();
          const current = productSalesMap.get(productKey) || {
            productId: productId._id,
            productName: productId.productName,
            productImage: productId.images,
            quantitySold: 0
          };
          current.quantitySold += quantity;
          productSalesMap.set(productKey, current);
        }

        if (sellerId) {
          const sellerKey = sellerId._id?.toString();
          const current = sellerSalesMap.get(sellerKey) || {
            sellerId: sellerId._id,
            sellerName: `${sellerId.firstName} ${sellerId.lastName}`,
            sellerImage: sellerId.profilePicture,
            totalSold: 0
          };
          current.totalSold += quantity;
          sellerSalesMap.set(sellerKey, current);
        }
      });
    });

    const productSales = Array.from(productSalesMap.values());
    const sellerSales = Array.from(sellerSalesMap.values());

    const mostPurchasedProduct = productSales.sort((a, b) => b.quantitySold - a.quantitySold)[0] || null;
    const leastPurchasedProduct = productSales.sort((a, b) => a.quantitySold - b.quantitySold)[0] || null;
    const topSeller = sellerSales.sort((a, b) => b.totalSold - a.totalSold)[0] || null;

    return {
      mostPurchasedProduct,
      leastPurchasedProduct,
      topSeller
    };

  } catch (error) {
    console.log('Something went wrong: Service: retrieveProductSalesAnalytics', error);
    throw new Error(error.message);
  }
},


 retrieveTopMostPurchasedProducts : async (filters = {}) => {
  try {
   const category = filters.category;
const dateFilter = filters.dateFilter || 'thisYear';


    let startDate = null;
    let endDate = null;

    switch (dateFilter) {
      case 'thisWeek':
        startDate = moment().startOf('week');
        endDate = moment().endOf('week');
        break;
      case 'lastWeek':
        startDate = moment().subtract(1, 'weeks').startOf('week');
        endDate = moment().subtract(1, 'weeks').endOf('week');
        break;
      case 'thisMonth':
        startDate = moment().startOf('month');
        endDate = moment().endOf('month');
        break;
      case 'lastMonth':
        startDate = moment().subtract(1, 'months').startOf('month');
        endDate = moment().subtract(1, 'months').endOf('month');
        break;
      case 'thisYear':
        startDate = moment().startOf('year');
        endDate = moment().endOf('year');
        break;
      case 'lastYear':
        startDate = moment().subtract(1, 'years').startOf('year');
        endDate = moment().subtract(1, 'years').endOf('year');
        break;
    }

    const query = {};
    if (startDate && endDate) {
      query.orderDate = { $gte: startDate.toDate(), $lte: endDate.toDate() };
    }

    const allOrders = await Order.find(query)
      .populate({
        path: 'products.productId',
        select: 'productName images category price',
      });

    const productSalesMap = new Map();
    let totalAmountForAllProducts = 0;

    allOrders.forEach(order => {
      order.products.forEach(item => {
        const { productId, quantity, price, totalPrice } = item;

        if (!productId) return;

        if (category && productId.category !== category) return;

        const productKey = productId._id?.toString();
        const productData = productSalesMap.get(productKey) || {
          productId: productId._id,
          productName: productId.productName,
          productImage: productId.images,
          totalQuantitySold: 0,
          totalAmountSold: 0
        };

        const qty = quantity || Math.round(totalPrice / (price || 1));
        const amount = qty * (price || 0);

        productData.totalQuantitySold += qty;
        productData.totalAmountSold += amount;

        totalAmountForAllProducts += amount;

        productSalesMap.set(productKey, productData);
      });
    });

    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.totalQuantitySold - a.totalQuantitySold)
      .slice(0, 10);

    return {
      totalAmountForAllProducts,
      topProducts
    };

  } catch (error) {
    console.error('Error in retrieveTopMostPurchasedProducts:', error);
    throw new Error(error.message);
  }
}

    
    
}





