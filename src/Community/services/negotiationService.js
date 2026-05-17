const Negotiation = require('../models/negotiationModel');
const {
  NEGOTIATION_EXPIRY_HOURS,
  NEGOTIATION_MIN_DISCOUNT,
  NEGOTIATION_MAX_DISCOUNT,
} = require('../constants/community');

const getExpiryDate = () => {
  const d = new Date();
  d.setHours(d.getHours() + NEGOTIATION_EXPIRY_HOURS);
  return d;
};

const createNegotiation = async ({ productId, buyerId, sellerId, type, originalPrice, requestedPrice, quantity, buyerNote }) => {
  const discount = (originalPrice - requestedPrice) / originalPrice;
  if (discount < NEGOTIATION_MIN_DISCOUNT || discount > NEGOTIATION_MAX_DISCOUNT) {
    throw new Error(`Requested price must be between ${Math.round((1 - NEGOTIATION_MAX_DISCOUNT) * 100)}% and ${Math.round((1 - NEGOTIATION_MIN_DISCOUNT) * 100)}% of original price`);
  }

  const active = await Negotiation.findOne({
    productId,
    buyerId,
    status: { $in: ['pending', 'countered'] },
  });
  if (active) throw new Error('You already have an active negotiation for this product');

  const negotiation = await Negotiation.create({
    productId,
    buyerId,
    sellerId,
    type,
    originalPrice,
    requestedPrice,
    quantity: quantity || 1,
    buyerNote: buyerNote || '',
    expiresAt: getExpiryDate(),
    messages: [
      {
        senderId: buyerId,
        senderType: 'buyer',
        type: 'offer',
        price: requestedPrice,
        quantity: quantity || 1,
        note: buyerNote || '',
      },
    ],
  });

  return negotiation;
};

const counterOffer = async ({ negotiationId, sellerId, counterPrice, note }) => {
  const negotiation = await Negotiation.findOne({ _id: negotiationId, sellerId });
  if (!negotiation) throw new Error('Negotiation not found');
  if (!['pending', 'countered'].includes(negotiation.status)) {
    throw new Error('This negotiation can no longer be updated');
  }

  const discount = (negotiation.originalPrice - counterPrice) / negotiation.originalPrice;
  if (discount < NEGOTIATION_MIN_DISCOUNT || discount > NEGOTIATION_MAX_DISCOUNT) {
    throw new Error('Counter price is out of acceptable range');
  }

  negotiation.counterPrice = counterPrice;
  negotiation.status = 'countered';
  negotiation.expiresAt = getExpiryDate();
  negotiation.isViewedByBuyer = false;
  negotiation.messages.push({
    senderId: sellerId,
    senderType: 'seller',
    type: 'counter',
    price: counterPrice,
    note: note || '',
  });

  await negotiation.save();
  return negotiation;
};

const acceptNegotiation = async ({ negotiationId, acceptorId, acceptorType }) => {
  const query =
    acceptorType === 'buyer'
      ? { _id: negotiationId, buyerId: acceptorId }
      : { _id: negotiationId, sellerId: acceptorId };

  const negotiation = await Negotiation.findOne(query);
  if (!negotiation) throw new Error('Negotiation not found');
  if (!['pending', 'countered'].includes(negotiation.status)) {
    throw new Error('This negotiation can no longer be accepted');
  }

  const finalPrice =
    negotiation.status === 'countered' ? negotiation.counterPrice : negotiation.requestedPrice;

  negotiation.status = 'accepted';
  negotiation.finalPrice = finalPrice;
  negotiation.generateCheckoutToken();
  negotiation.messages.push({
    senderId: acceptorId,
    senderType: acceptorType,
    type: 'accept',
    price: finalPrice,
  });

  await negotiation.save();
  return negotiation;
};

const rejectNegotiation = async ({ negotiationId, rejectorId, rejectorType, note }) => {
  const query =
    rejectorType === 'buyer'
      ? { _id: negotiationId, buyerId: rejectorId }
      : { _id: negotiationId, sellerId: rejectorId };

  const negotiation = await Negotiation.findOne(query);
  if (!negotiation) throw new Error('Negotiation not found');
  if (!['pending', 'countered'].includes(negotiation.status)) {
    throw new Error('This negotiation cannot be rejected at this stage');
  }

  negotiation.status = 'rejected';
  negotiation.messages.push({
    senderId: rejectorId,
    senderType: rejectorType,
    type: 'reject',
    note: note || '',
  });

  await negotiation.save();
  return negotiation;
};

const getBuyerNegotiations = async ({ buyerId, status, page = 1 }) => {
  const query = { buyerId };
  if (status) query.status = status;

  const limit = 20;
  const skip = (page - 1) * limit;

  const [negotiations, total] = await Promise.all([
    Negotiation.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Negotiation.countDocuments(query),
  ]);

  return { negotiations, total, page, pages: Math.ceil(total / limit) };
};

const getSellerNegotiations = async ({ sellerId, status, page = 1 }) => {
  const query = { sellerId };
  if (status) query.status = status;

  const limit = 20;
  const skip = (page - 1) * limit;

  const [negotiations, total] = await Promise.all([
    Negotiation.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Negotiation.countDocuments(query),
  ]);

  await Negotiation.updateMany(
    { sellerId, status: { $in: ['pending', 'countered'] }, isViewedBySeller: false },
    { $set: { isViewedBySeller: true } }
  );

  return { negotiations, total, page, pages: Math.ceil(total / limit) };
};

const validateCheckoutToken = async ({ token, buyerId }) => {
  const negotiation = await Negotiation.findOne({
    checkoutToken: token,
    buyerId,
    status: 'accepted',
  });
  if (!negotiation) throw new Error('Invalid or expired checkout token');
  if (negotiation.expiresAt < new Date()) throw new Error('Checkout token has expired');
  return negotiation;
};

module.exports = {
  createNegotiation,
  counterOffer,
  acceptNegotiation,
  rejectNegotiation,
  getBuyerNegotiations,
  getSellerNegotiations,
  validateCheckoutToken,
};
