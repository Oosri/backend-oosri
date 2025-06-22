const UserCart = require('../../Buyer/models/buyerCartModel');
const crypto = require('crypto');

module.exports.retrieveOrCreateCart = async (user, cartKey) => {
  let cart;

  if (user) {
    cart = await UserCart.findOne({ userId: user });
    if (!cart) {
      cart = new UserCart({
        userId: user,
        items: [],
      });
      await cart.save();
    }
    return cart;
  }

  if (cartKey) {
    cart = await UserCart.findOne({ cartKey });
    if (!cart) {
      cart = new UserCart({
        cartKey,
        items: [],
      });
      await cart.save();
    }
    return cart;
  }

  throw new Error("Either user or cartKey must be provided.");
};


module.exports.generateCartKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';

    for (let i = 0; i < 12; i++) {
        const randomIndex = crypto.randomInt(0, chars.length);
        key += chars[randomIndex];
    }

    return (
        key.substring(0, 4).toUpperCase() + '-' +
        key.substring(4, 8).toUpperCase() + '-' +
        key.substring(8, 12).toUpperCase()
    );
}