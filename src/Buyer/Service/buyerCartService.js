const UserCart = require('../../Buyer/models/buyerCartModel');
const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const guestCart = require('../../Buyer/models/guestCartModel');
const userCartHelper = require('../helper/cartFunction');
const buyerProductReview = require('../../Buyer/models/buyerProductReviewModel');
const { getFxRateNGNtoUSD } = require('../Service/fxService');

function addUSDPrices(product, fxRate) {
  if (!fxRate) return product;

  const convertToUSD = (amountNGN) => {
    if (!amountNGN || amountNGN === 0) return null;
    return Number((amountNGN * fxRate).toFixed(2));
  };

  // Use productPrice (homepage format) or regularPrice as fallback
  const price = product.productPrice || product.regularPrice;

  return {
    ...product,
    regularPriceUSD: convertToUSD(price),
    salesPriceUSD: convertToUSD(product.salesPrice),
    previousPriceUSD: convertToUSD(product.previousPrice),
    fxRate: fxRate
  };
}

module.exports = {
  addToCart: async ({ userId, cartKey, items }) => {
    try {
      const productIds = items.map((item) => item.productId);
      const validProducts = await Product.find({ _id: { $in: productIds } })
        .populate('category', 'name')
        .populate('subcategory', 'name');

      if (validProducts.length !== productIds.length) {
        throw new Error(constants.buyerProductMessage.INVALID_PRODUCT_ID);
      }

      const productMap = {};
      validProducts.forEach((product) => {
        productMap[product._id.toString()] = product;
      });

      const cart = await userCartHelper.retrieveOrCreateCart(userId, cartKey);

      for (const incomingItem of items) {
        const existingIndex = cart.items.findIndex(
          (item) =>
            item.productId.toString() === incomingItem.productId.toString()
        );

        if (existingIndex !== -1) {
          const newQty =
            cart.items[existingIndex].quantity + incomingItem.quantity;

          if (newQty <= 0) {
            cart.items.splice(existingIndex, 1);
          } else {
            cart.items[existingIndex].quantity = newQty;
          }
        } else if (incomingItem.quantity > 0) {
          cart.items.push({
            productId: incomingItem.productId,
            quantity: incomingItem.quantity
          });
        }
      }

      await cart.save();

      const formattedCart = mongoDbDataFormat.formatMongoData(cart);

      // Fetch FX rate for USD conversion
      let fxRate = null;
      try {
        fxRate = await getFxRateNGNtoUSD();
      } catch (fxError) {
        console.warn(
          'Failed to fetch FX rate for USD conversion:',
          fxError.message
        );
      }

      formattedCart.items = await Promise.all(
        cart.items.map(async (item) => {
          const product = productMap[item.productId.toString()];

          if (!product) return null;

          const sellerDetails = await mongoDbDataFormat.getSellerDetails(
            product.seller
          );
          const sellerName = sellerDetails
            ? `${sellerDetails.firstName} ${sellerDetails.lastName}`
            : 'Unknown Seller';

          const productReviews = await buyerProductReview.find({
            productId: product._id
          });

          let productRating = 0;

          if (productReviews.length > 0) {
            const validRatings = productReviews
              .map((review) => Number(review.productRating))
              .filter((rating) => !isNaN(rating));

            if (validRatings.length > 0) {
              const totalRating = validRatings.reduce(
                (sum, rating) => sum + rating,
                0
              );
              productRating = totalRating / validRatings.length;
              productRating = Math.round(productRating * 10) / 10;
            }
          }

          const productData = {
            _id: product._id,
            productName: product.productName,
            productPrice: product.regularPrice,
            previousPrice: product.previousPrice,
            productCategory: product.category?.name || null,
            productSubcategory: product.subcategory?.name || null,
            sellerName: sellerName,
            productRating: productRating,
            productImages: product.images || []
          };

          const formattedProduct = addUSDPrices(productData, fxRate);

          const productPrice = product.regularPrice;
          const totalAmount = productPrice * item.quantity;

          return {
            ...formattedProduct,
            quantity: item.quantity,
            totalAmount: totalAmount,
            totalAmountUSD: fxRate
              ? Number((totalAmount * fxRate).toFixed(2))
              : null
          };
        })
      );

      formattedCart.items = formattedCart.items.filter(Boolean);

      return formattedCart;
    } catch (error) {
      console.error('Something went wrong in addToCart:', error);
      throw new Error(error.message);
    }
  },

  mergeCarts: async (userId, cartKey) => {
    try {
      const guestCart = await UserCart.findOne({ cartKey, userId: null });

      if (!guestCart) {
        const existingCart = await UserCart.findOne({ cartKey });

        if (existingCart && existingCart.userId) {
          throw new Error(
            'Cart key is already assigned to a user. Please generate a new cart key.'
          );
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

          const matchIndex = userItems.findIndex((userItem) => {
            const sameProduct =
              userItem.productId.toString() === guestItem.productId.toString();
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
          select: 'productName regularPrice images category categoryType',
          populate: {
            path: 'category',
            select: '_id name'
          }
        });
      } else if (cartKey) {
        cart = await UserCart.findOne({ cartKey }).populate({
          path: 'items.productId',
          select: 'productName regularPrice images category categoryType',
          populate: {
            path: 'category',
            select: '_id name'
          }
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

      let totalItems = 0;
      let totalProducts = 0;
      let subtotal = 0;

      const currencyFormatter = new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0
      });

      const cartItemsWithRelated = await Promise.all(
        cart.items.map(async (item) => {
          let product = item.productId;

          if (
            !product ||
            typeof product === 'string' ||
            product._id === undefined
          ) {
            try {
              const fallbackId =
                typeof product === 'string' ? product : item.productId;
              if (!fallbackId) return null;

              product = await Product.findById(fallbackId)
                .select('productName regularPrice images category categoryType')
                .populate({ path: 'category', select: '_id name' });

              if (!product) return null;
            } catch (err) {
              return null;
            }
          }

          const productPrice = product.regularPrice;
          const productSubtotal = productPrice * item.quantity;

          totalItems += item.quantity;
          subtotal += productSubtotal;

          const relatedProducts = await Product.find({
            category: product.category?._id || product.category,
            _id: { $ne: product._id }
          })
            .select('productName images regularPrice')
            .limit(4);

          return {
            _id: product._id,
            productName: product.productName,
            productImages: product.images,
            price: productPrice,
            quantity: item.quantity,
            totalAmount: productSubtotal,
            relatedProducts: relatedProducts.map((rp) => ({
              productId: rp._id,
              productName: rp.productName,
              productImages: rp.images,
              price: rp.regularPrice
            }))
          };
        })
      );

      const filteredCartItems = cartItemsWithRelated.filter(
        (item) => item !== null
      );
      totalProducts = filteredCartItems.length;

      return {
        cartId: cart._id,
        cartItems: filteredCartItems,
        cartSummary: {
          totalProducts,
          totalItems,
          subtotal: subtotal,
          totalAmount: subtotal
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
      } else if (cartKey) {
        cart = await UserCart.findOne({ cartKey });
        if (!cart) {
          throw new Error(constants.CartMessage.EMPTY_CART);
        }
      } else {
        throw new Error(constants.CartMessage.USER_ID_CART_KEY_REQUIRED);
      }

      cart.items = cart.items.filter((item) => {
        return item.productId.toString() !== productId.toString();
      });

      await cart.save();

      return [];
    } catch (error) {
      console.log('Something went wrong: Service: removeUserCartItem', error);
      throw new Error(error.message);
    }
  },

  generateUniqueCartKey: async () => {
    let cartKey;
    let exists;

    do {
      cartKey = userCartHelper.generateCartKey();
      exists = await UserCart.findOne({ cartKey });
    } while (exists !== null);

    return cartKey;
  }
};
