/**
 * Unit tests — buyerCartService
 * Covers: retrieveUserCart (no cart, empty, with items),
 *         removeUserCartItem (not in cart, success)
 */

const { BUYER_OID, PRODUCT_OID } = require('../helpers/factories');

jest.mock('../../src/Buyer/models/buyerCartModel');
jest.mock('../../src/models/productModel', () => ({
  Product: {
    populate:       jest.fn(),
    findById:       jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));
jest.mock('../../src/Buyer/Service/fxService', () => ({
  getFxRateNGNtoUSD: jest.fn().mockResolvedValue(0.00065),
}));
jest.mock('../../src/Buyer/helper/dbHelper', () => ({
  formatMongoData: (d) => ({ ...d }),
  checkObjectId:   jest.fn(),
}));
jest.mock('../../src/Buyer/constants', () => ({
  CartMessage: {
    USER_ID_CART_KEY_REQUIRED: 'userId or cartKey required',
    ITEM_NOT_FOUND:            'Item not found in cart',
    CART_NOT_FOUND:            'Cart not found',
  },
}));

const UserCart    = require('../../src/Buyer/models/buyerCartModel');
const { Product } = require('../../src/models/productModel');
const svc         = require('../../src/Buyer/Service/buyerCartService');

beforeEach(() => jest.clearAllMocks());

// ─── retrieveUserCart ─────────────────────────────────────────────────────────

describe('retrieveUserCart', () => {
  it('throws when neither userId nor cartKey is provided', async () => {
    await expect(svc.retrieveUserCart({})).rejects.toThrow();
  });

  it('returns empty cart summary when no cart exists', async () => {
    UserCart.findOne = jest.fn().mockResolvedValue(null);

    const result = await svc.retrieveUserCart({ userId: BUYER_OID });
    expect(result.cartItems).toHaveLength(0);
    expect(result.cartSummary.totalProducts).toBe(0);
    expect(result.cartSummary.subtotal).toBe(0);
  });

  it('returns empty cart summary when cart has no items', async () => {
    UserCart.findOne = jest.fn().mockResolvedValue({
      userId: BUYER_OID,
      items:  [],
      save:   jest.fn(),
    });
    Product.populate = jest.fn().mockResolvedValue([]);

    const result = await svc.retrieveUserCart({ userId: BUYER_OID });
    expect(result.cartItems).toHaveLength(0);
    expect(result.totalItems).toBe(0);
  });

  it('looks up cart by cartKey for guest users', async () => {
    UserCart.findOne = jest.fn().mockResolvedValue(null);
    await svc.retrieveUserCart({ cartKey: 'guest-key-123' });
    expect(UserCart.findOne).toHaveBeenCalledWith({ cartKey: 'guest-key-123' });
  });

  it('looks up cart by userId for logged-in users', async () => {
    UserCart.findOne = jest.fn().mockResolvedValue(null);
    await svc.retrieveUserCart({ userId: BUYER_OID });
    expect(UserCart.findOne).toHaveBeenCalledWith({ userId: BUYER_OID });
  });
});

// ─── removeUserCartItem ───────────────────────────────────────────────────────

describe('removeUserCartItem', () => {
  it('throws when cart not found', async () => {
    UserCart.findOne = jest.fn().mockResolvedValue(null);
    await expect(svc.removeUserCartItem(PRODUCT_OID, BUYER_OID)).rejects.toThrow();
  });

  it('leaves cart unchanged when item is not in cart', async () => {
    const mockSave = jest.fn().mockResolvedValue({});
    const cart = {
      userId: BUYER_OID,
      items:  [{ productId: 'different-id', quantity: 1 }],
      save:   mockSave,
    };
    UserCart.findOne = jest.fn().mockResolvedValue(cart);
    await svc.removeUserCartItem(PRODUCT_OID, BUYER_OID);
    expect(cart.items).toHaveLength(1);
    expect(mockSave).toHaveBeenCalled();
  });

  it('removes the matching item and saves', async () => {
    const mockSave = jest.fn().mockResolvedValue({});
    const cart = {
      userId: BUYER_OID,
      items:  [{ productId: PRODUCT_OID, quantity: 2, toObject: () => ({}) }],
      save:   mockSave,
    };
    UserCart.findOne = jest.fn().mockResolvedValue(cart);

    await svc.removeUserCartItem(PRODUCT_OID, BUYER_OID);
    expect(cart.items).toHaveLength(0);
    expect(mockSave).toHaveBeenCalled();
  });
});
