const negotiationService = require('../services/negotiationService');
const { SOCKET_EVENTS } = require('../constants/community');

const getIo = (req) => req.app.get('io');

const emitToNegotiationParties = (io, negotiation, event) => {
  if (!io) return;
  io.to(`user:${negotiation.buyerId}`).emit(event, negotiation);
  io.to(`user:${negotiation.sellerId}`).emit(event, negotiation);
};

const createNegotiation = async (req, res) => {
  try {
    const { productId, sellerId, type, originalPrice, requestedPrice, quantity, buyerNote } = req.body;
    const { actorId } = req.community;

    const negotiation = await negotiationService.createNegotiation({
      productId,
      buyerId: actorId,
      sellerId,
      type,
      originalPrice,
      requestedPrice,
      quantity,
      buyerNote,
    });

    emitToNegotiationParties(getIo(req), negotiation, SOCKET_EVENTS.NEGOTIATION_NEW);

    return res.status(201).json({ status: 201, success: true, data: negotiation });
  } catch (err) {
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
};

const counterOffer = async (req, res) => {
  try {
    const { negotiationId } = req.params;
    const { counterPrice, note } = req.body;
    const { actorId } = req.community;

    const negotiation = await negotiationService.counterOffer({
      negotiationId,
      sellerId: actorId,
      counterPrice,
      note,
    });

    emitToNegotiationParties(getIo(req), negotiation, SOCKET_EVENTS.NEGOTIATION_COUNTERED);

    return res.status(200).json({ status: 200, success: true, data: negotiation });
  } catch (err) {
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
};

const acceptNegotiation = async (req, res) => {
  try {
    const { negotiationId } = req.params;
    const { actorId, actorType } = req.community;

    const negotiation = await negotiationService.acceptNegotiation({
      negotiationId,
      acceptorId: actorId,
      acceptorType: actorType,
    });

    emitToNegotiationParties(getIo(req), negotiation, SOCKET_EVENTS.NEGOTIATION_ACCEPTED);

    return res.status(200).json({ status: 200, success: true, data: negotiation });
  } catch (err) {
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
};

const rejectNegotiation = async (req, res) => {
  try {
    const { negotiationId } = req.params;
    const { note } = req.body;
    const { actorId, actorType } = req.community;

    const negotiation = await negotiationService.rejectNegotiation({
      negotiationId,
      rejectorId: actorId,
      rejectorType: actorType,
      note,
    });

    emitToNegotiationParties(getIo(req), negotiation, SOCKET_EVENTS.NEGOTIATION_REJECTED);

    return res.status(200).json({ status: 200, success: true, data: negotiation });
  } catch (err) {
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
};

const getBuyerNegotiations = async (req, res) => {
  try {
    const { actorId } = req.community;
    const { status, page } = req.query;

    const result = await negotiationService.getBuyerNegotiations({
      buyerId: actorId,
      status,
      page: parseInt(page, 10) || 1,
    });

    return res.status(200).json({ status: 200, success: true, data: result });
  } catch (err) {
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
};

const getSellerNegotiations = async (req, res) => {
  try {
    const { actorId } = req.community;
    const { status, page } = req.query;

    const result = await negotiationService.getSellerNegotiations({
      sellerId: actorId,
      status,
      page: parseInt(page, 10) || 1,
    });

    return res.status(200).json({ status: 200, success: true, data: result });
  } catch (err) {
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
};

const validateCheckoutToken = async (req, res) => {
  try {
    const { token } = req.params;
    const { actorId } = req.community;

    const negotiation = await negotiationService.validateCheckoutToken({ token, buyerId: actorId });
    return res.status(200).json({ status: 200, success: true, data: negotiation });
  } catch (err) {
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
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
