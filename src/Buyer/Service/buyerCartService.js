const UserCart = require('../../Buyer/models/buyerCartModel');
const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const guestCart = require('../../Buyer/models/guestCartModel')
const userCartHelper = require('../helper/cartFunction');


module.exports = {
  
addToCart : async ({userId, cartKey, items}) => {
  try {
    const productIds = items.map(item => item.productId);
    const validProducts = await Product.find({ _id: { $in: productIds } });

    if (validProducts.length !== productIds.length) {
      throw new Error(constants.buyerProductMessage.INVALID_PRODUCT_ID);
    }
    const productMap = {};
validProducts.forEach(product => {
  productMap[product._id.toString()] = product;
});

    const cart = await userCartHelper.retrieveOrCreateCart(userId, cartKey); 

    for (const incomingItem of items) {
      const existingIndex = cart.items.findIndex(item =>
        item.productId.toString() === incomingItem.productId.toString()
      );

      if (existingIndex !== -1) {
        const newQty = cart.items[existingIndex].quantity + incomingItem.quantity;

        if (newQty <= 0) {
          cart.items.splice(existingIndex, 1);
        } else {
          cart.items[existingIndex].quantity = newQty;
        }
      } else if (incomingItem.quantity > 0) {
        cart.items.push({
          productId: incomingItem.productId,
          quantity: incomingItem.quantity,
        });
      }
    }

    await cart.save();

    const savedCart = await cart.constructor.findById(cart._id).populate({
      path: 'items.productId',
      select: 'productName regularPrice images'
    });

    const formattedCart = mongoDbDataFormat.formatMongoData(savedCart);

    const currencyFormatter = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    });

   formattedCart.items = cart.items.map(item => {
  const product = productMap[item.productId.toString()];

  if (!product) return null; 

  const productPrice = product.regularPrice;
  const totalAmount = productPrice * item.quantity;

  return {
    _id: product._id,
    productId: product.productId,
    productName: product.productName,
    productImage: product.images,
    price: currencyFormatter.format(productPrice),
    quantity: item.quantity,
    totalAmount: currencyFormatter.format(totalAmount)
  };
}).filter(Boolean);


    return formattedCart;
  } catch (error) {
    console.error('Something went wrong in addToCart:', error);
    throw new Error(error.message);
  }
},
  
 mergeCarts : async (userId, cartKey) => {
  try {
    const guestCart = await UserCart.findOne({ cartKey, userId: null });

    if (!guestCart) {
      const existingCart = await UserCart.findOne({ cartKey });

      if (existingCart && existingCart.userId) {
        throw new Error('Cart key is already assigned to a user. Please generate a new cart key.');
      }

      throw new Error(constants.CartMessage.INVALID_CART_KEY);
    }

    let userCart = await UserCart.findOne({ userId });

    if (!userCart) {
      guestCart.userId = userId;
      await guestCart.save();
    } else {
      const userItems = userCart.items;
      const guestItems = guestCart.items;

      for (const guestItem of guestItems) {
        const guestVariationId = guestItem.variationId?.toString() || null;

        const matchIndex = userItems.findIndex(userItem => {
          const sameProduct = userItem.productId.toString() === guestItem.productId.toString();
          const sameVariation =
            (userItem.variationId?.toString() || null) === guestVariationId;
          return sameProduct && sameVariation;
        });

        if (matchIndex !== -1) {
          userItems[matchIndex].quantity += guestItem.quantity;
        } else {
          userItems.push(guestItem);
        }
      }

      userCart.items = userItems;
      await userCart.save();

      await guestCart.deleteOne();
    }

    return [];

  } catch (error) {
    console.error('Something went wrong while merging carts:', error);
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
          select: 'productName regularPrice images',
        });
      } else if (cartKey) {
        cart = await UserCart.findOne({ cartKey }).populate({
          path: 'items.productId',
          select: 'productName regularPrice images',
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
  
      const currencyFormatter = new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN', 
        minimumFractionDigits: 0,  
      });
  
      formattedCart.products = cart.items.map(item => {
        const productPrice = item.productId.regularPrice;
        const productSubtotal = productPrice * item.quantity;
        totalItems += item.quantity;  
        subtotal += productSubtotal;  
  
        return {
          productId: item.productId._id,
          productName: item.productId.productName,
          productImage: item.productId.images,
          price: currencyFormatter.format(productPrice), 
          quantity: item.quantity,
          totalAmount: currencyFormatter.format(productSubtotal)  
        };
      });
  
      totalProducts = formattedCart.products.length;  
  
      return {
        cartItems: formattedCart.products,
        cartSummary: {
          totalProducts: totalProducts,
          totalItems: totalItems,
          subtotal: currencyFormatter.format(subtotal),  
          totalAmount: currencyFormatter.format(subtotal)  
        }
      };
  
    } catch (error) {
      console.log('Something went wrong: Service: retrieveCart', error);
      throw new Error(error.message);
    }
  },

  
  removeUserCartItem: async (productId, userId, cartKey) => {
    try {
      if (!productId) {
        throw new Error(constants.buyerProductMessage.INVALID_PRODUCT_ID);
      }
  
      let cart;
  
      if (userId) {
        cart = await UserCart.findOne({ userId });
        if (!cart) {
          throw new Error(constants.CartMessage.EMPTY_CART);
        }
      }
      else if (cartKey) {
        cart = await UserCart.findOne({ cartKey });
        if (!cart) {
          throw new Error(constants.CartMessage.EMPTY_CART);

        }
      } else {
        throw new Error(constants.CartMessage.USER_ID_CART_KEY_REQUIRED);
      }
  
     
  
      cart.items = cart.items.filter(item => {
        return item.productId.toString() !== productId.toString();
      });
  
   
  
      await cart.save();
  
      return [];
  
    } catch (error) {
      console.log('Something went wrong: Service: removeUserCartItem', error);
      throw new Error(error.message);
    }
  },

  generateUniqueCartKey: async() => {
    let cartKey;
    let exists;

    do {
        cartKey = userCartHelper.generateCartKey();
        exists = await UserCart.findOne({ cartKey });
    } while (exists !== null);

    return cartKey;
}
};  