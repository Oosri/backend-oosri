const UserCart = require('../../Buyer/models/buyerCartModel');
const { Product } = require('../../models/productModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const guestCart = require('../../Buyer/models/guestCartModel')
const userCartHelper = require('../helper/cartFunction');
const fxService = require('./adminControlledFxService');
const buyerProductReview = require('../../Buyer/models/buyerProductReviewModel');


module.exports = {

  addToCart: async ({ userId, cartKey, items }) => {
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
        const product = productMap[incomingItem.productId.toString()];

        if (product && incomingItem.quantity > 0) {
          const existingQty = cart.items.find(
            item => item.productId.toString() === incomingItem.productId.toString()
          )?.quantity || 0;
          const totalQty = existingQty + incomingItem.quantity;

          if (totalQty > product.inStock) {
            throw new Error(
              `Only ${product.inStock} unit${product.inStock === 1 ? '' : 's'} of "${product.productName}" available.`
            );
          }
        }

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

      const fxRate = await fxService.getFxRateNGNtoUSD();

      formattedCart.items = cart.items.map(item => {
        const product = productMap[item.productId.toString()];

        if (!product) return null;

        const productPrice = product.regularPrice;
        const totalAmount = productPrice * item.quantity;

        // Calculate USD values
        const priceInUsd = productPrice * fxRate;
        const totalAmountInUsd = totalAmount * fxRate;

        return {
          _id: product._id,
          productId: product.productId,
          productName: product.productName,
          productImage: product.images,
          price: productPrice,
          priceInUsd: Number(priceInUsd.toFixed(2)),
          quantity: item.quantity,
          totalAmount: totalAmount,
          totalAmountInUsd: Number(totalAmountInUsd.toFixed(2))
        };
      }).filter(Boolean);


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
      const { userId, cartKey, page = 1, limit = 10 } = serviceData;

      let cart;

      // STEP 1: Fetch raw cart (no populate yet) to get total count
      if (userId) {
        mongoDbDataFormat.checkObjectId(userId);
        cart = await UserCart.findOne({ userId });
      } else if (cartKey) {
        cart = await UserCart.findOne({ cartKey });
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
          },
          currentPage: 1,
          totalPages: 0,
          totalItems: 0
        };
      }

      const totalItemsInCart = cart.items.length;
      const totalPages = Math.ceil(totalItemsInCart / limit);
      const skip = (page - 1) * limit;

      // STEP 2: Slice items for the current page
      const paginatedItems = cart.items.slice(skip, skip + limit);

      // STEP 3: Manually populate ONLY the sliced items
      // We use Product.populate which can populate plain objects or docs
      await Product.populate(paginatedItems, {
        path: 'productId',
        populate: [
          { path: 'category', select: '_id name' },
          { path: 'subcategory', select: '_id name' }
        ]
      });

      let subtotal = 0;
      let totalItemsQuantity = 0;

      const currencyFormatter = new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
      });

      const fxRate = await fxService.getFxRateNGNtoUSD();
      let subtotalInUsd = 0;

      const cartItemsWithRelated = await Promise.all(
        paginatedItems.map(async (item) => {
          let product = item.productId;

          if (!product || typeof product === 'string' || product._id === undefined) {
            // Handle broken references
            return null;
          }

          const productPrice = product.regularPrice;
          const productSubtotal = productPrice * item.quantity;

          // USD calculations
          const priceInUsd = productPrice * fxRate;
          const productSubtotalInUsd = productSubtotal * fxRate;

          totalItemsQuantity += item.quantity;
          subtotal += productSubtotal;
          subtotalInUsd += productSubtotalInUsd;

          const relatedProducts = await Product.find({
            category: product.category?._id || product.category,
            _id: { $ne: product._id }
          })
            .select('productName images regularPrice')
            .limit(4);

          // Used for both main product and related products
          const convertToUSD = (amountNGN) => {
            if (!amountNGN || amountNGN === 0) return null;
            return fxRate ? Number((amountNGN * fxRate).toFixed(2)) : null;
          };

          // Fetch Seller Details
          const sellerDetails = await mongoDbDataFormat.getSellerDetails(product.seller);
          const sellerName = sellerDetails
            ? `${sellerDetails.firstName} ${sellerDetails.lastName}`
            : 'Unknown Seller';

          // Fetch Ratings
          const productReviews = await buyerProductReview.find({
            productId: product._id
          });

          let productRating = 0;
          if (productReviews.length > 0) {
            const validRatings = productReviews
              .map((review) => Number(review.productRating))
              .filter((rating) => !isNaN(rating));

            if (validRatings.length > 0) {
              const totalRating = validRatings.reduce((sum, rating) => sum + rating, 0);
              productRating = totalRating / validRatings.length;
              productRating = Math.round(productRating * 10) / 10;
            }
          }

          // Match retrieveAllProducts structure
          const productData = {
            _id: product._id,
            productName: product.productName,
            productPrice: product.regularPrice,
            regularPrice: product.regularPrice,
            salesPrice: product.salesPrice || product.regularPrice,
            previousPrice: product.previousPrice,
            productCategory: product.category?.name || null,
            productSubcategory: product.subcategory?.name || null,
            sellerName: sellerName,
            productRating: productRating,
            productImages: product.images || [],

            // Cart Specific
            quantity: item.quantity,
            totalAmount: productSubtotal,
            totalAmountInUsd: Number(productSubtotalInUsd.toFixed(2)),

            // USD Prices
            regularPriceUSD: convertToUSD(product.regularPrice || product.productPrice),
            salesPriceUSD: convertToUSD(product.salesPrice),
            previousPriceUSD: convertToUSD(product.previousPrice),
            fxRate: fxRate,
            price: product.regularPrice, // Backward compatibility if needed
            priceInUsd: Number(priceInUsd.toFixed(2)), // Backward compatibility if needed

            relatedProducts: relatedProducts.map(rp => ({
              productId: rp._id,
              productName: rp.productName,
              productImages: rp.images,
              price: rp.regularPrice,
              priceInUsd: convertToUSD(rp.regularPrice)
            }))
          };

          return productData;
        })
      );

      const filteredCartItems = cartItemsWithRelated.filter(item => item !== null);

      return {
        cartId: cart._id,
        cartItems: filteredCartItems,
        cartSummary: {
          totalProducts: totalItemsInCart, // Total unique products in cart (not just page)
          totalItems: totalItemsQuantity, // Total quantity (of visible page)
          subtotal: subtotal,
          subtotalInUsd: Number(subtotalInUsd.toFixed(2)),
          totalAmount: subtotal,
          totalAmountInUsd: Number(subtotalInUsd.toFixed(2))
        },
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItemsInCart
      };
    } catch (error) {
      console.error('Something went wrong: Service: retrieveCart', error);
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
      console.error('Something went wrong: Service: removeUserCartItem', error);
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