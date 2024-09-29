const UserCart = require('../../Buyer/models/buyerCartModel');
const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const guestCart = require('../../Buyer/models/guestCartModel')

module.exports = {
  addToCart: async (serviceData) => {
    try {
      const userId = serviceData.user;
      const cartKey = serviceData.cartKey;
      const items = serviceData.items;
  
      const productIds = items.map(item => item.productId);
      const validProducts = await Product.find({ '_id': { $in: productIds } });
  
      if (validProducts.length !== productIds.length) {
        throw new Error(constants.buyerProductMessage.INVALID_PRODUCT_ID);
      }
  
      let cart;
  
      if (userId) {
        cart = await UserCart.findOne({ userId });
        if (!cart) {
          cart = new UserCart({ userId, items: [] });
        }
      } else {
        cart = await guestCart.findOne({ cartKey });
        if (!cart) {
          cart = new guestCart({ cartKey, items: [] });
        }
      }
  
      items.forEach(item => {
        const productIndex = cart.items.findIndex(cartItem => cartItem.productId.toString() === item.productId);
  
        if (productIndex !== -1) {
          cart.items[productIndex].quantity += item.quantity;
  
          if (cart.items[productIndex].quantity <= 0) {
            cart.items.splice(productIndex, 1);
          }
        } else {
          cart.items.push({
            productId: item.productId,
            quantity: item.quantity 
          });
        }
      });
  
      const result = await cart.save();
  
      let savedCart = await cart.constructor.findById(result._id).populate({
        path: 'items.productId',
        select: 'productName price images'
      });
  
      const formattedCarts = mongoDbDataFormat.formatMongoData(savedCart);
      return formattedCarts;
  
    } catch (error) {
      console.log('Something went wrong: Service: addToCart', error);
      throw new Error(error.message);
    }
  },
  
  
  

  mergeCarts: async (userId, cartKey) => {
    try {
      const guest = await guestCart.findOne({ cartKey });
  
      if (!guest) {
        throw new Error(constants.CartMessage.INVALID_CART_KEY);
      }
  
      let userCart = await UserCart.findOne({ userId });
  
      if (!userCart) {
        guest.userId = userId;
        userCart = new UserCart({
          userId,
          items: guest.items
        });
      } else {
        guest.items.forEach(item => {
          const productIndex = userCart.items.findIndex(cartItem => cartItem.productId.toString() === item.productId.toString());
          if (productIndex !== -1) {
            userCart.items[productIndex].quantity += item.quantity;
          } else {
            userCart.items.push(item);
          }
        });
      }
  
      await userCart.save();
  
      await guest.deleteOne({ cartKey });
  
      let formattedCarts = mongoDbDataFormat.formatMongoData(userCart);
      return formattedCarts;
  
    } catch (error) {
      console.log('Something went wrong while merging carts', error);
      throw new Error(error.message);
    }
  },
  retrieveUserCart: async (serviceData) => {
    try {
      const { userId, cartKey } = serviceData;  
  
      let cart;
  
      if (userId) {
        mongoDbDataFormat.checkObjectId(userId);
        cart = await UserCart.findOne({ userId }).populate({
          path: 'items.productId',
          select: 'productName price images',
        });
      } else if (cartKey) {
        cart = await guestCart.findOne({ cartKey }).populate({
          path: 'items.productId',
          select: 'productName price images',
        });
      } else {
        throw new Error(constants.CartMessage.USER_ID_CART_KEY_REQUIRED);
      }
  
      if (!cart) {
        return {
          cartItems: [],
          cartSummary: {
            totalProducts: 0,
            totalItems: 0,
            subtotal: 0,
            totalAmount: 0
          }
        };
      }
  
      let formattedCart = mongoDbDataFormat.formatMongoData(cart);
  
      let totalItems = 0;
      let totalProducts = 0; 
      let subtotal = 0;
  
      formattedCart.products = cart.items.map(item => {
        const productPrice = item.productId.price;
        const productSubtotal = productPrice * item.quantity;
        totalItems += item.quantity;  
        subtotal += productSubtotal;  
        return {
          productId: item.productId._id,
          productName: item.productId.productName,
          productImage: item.productId.images,
          price: productPrice,  
          quantity: item.quantity,
          totalAmount: productSubtotal
        };
      });
  
      totalProducts = formattedCart.products.length;  
  
      return {
        cartItems: formattedCart.products,
        cartSummary: {
          totalProducts: totalProducts,
          totalItems: totalItems,
          subtotal: subtotal,
          totalAmount: subtotal  
        }
      };
  
    } catch (error) {
      console.log('Something went wrong: Service: retrieveCart', error);
      throw new Error(error.message);
    }
  },
  
  


removeUserCart : async (id) => {
  try {
    mongoDbDataFormat.checkObjectId(id);
    
    let cart = await UserCart.findByIdAndDelete(id).populate({
      path: 'items.productId',
      select: 'productName price images'  
    });
    
    if (!cart) {
      throw new Error(constants.CartMessage.EMPTY_CART);
    }
    
    let formattedCart = mongoDbDataFormat.formatMongoData(cart);
    formattedCart.products = formattedCart.items.map(item => ({
      productId: item.productId._id,
      productName: item.productId.productName,
      productImage: item.productId. images,
      quantity: item.quantity,
      totalAmount: item.productId.price * item.quantity
    }));
    formattedCart.totalCartAmount = formattedCart.products.reduce((sum, product) => sum + product.totalAmount, 0);
    delete formattedCart.items;
    
    return formattedCart;
  } catch (error) {
    console.log('Something went wrong: Service: removeUserCart', error);
    throw new Error(error.message);
  }
}
};
