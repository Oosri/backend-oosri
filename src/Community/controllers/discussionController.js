const discussionService = require('../services/discussionService');
const ModerationReport = require('../models/moderationReportModel');
const Product = require('../../models/productModel');
const { SOCKET_EVENTS } = require('../constants/community');

const getIo = (req) => req.app.get('io');

const createDiscussion = async (req, res) => {
  try {
    const { productId, content, type } = req.body;
    const { actorId, actorType } = req.community;

    if (!productId || !content) {
      return res.status(400).json({ status: 400, success: false, message: 'productId and content are required' });
    }

    // Always resolve sellerId from the product — never trust client-provided value
    const product = await Product.findById(productId).select('seller').lean();
    if (!product) {
      return res.status(404).json({ status: 404, success: false, message: 'Product not found' });
    }
    const sellerId = product.seller;

    const discussion = await discussionService.createDiscussion({
      productId,
      sellerId,
      authorId: actorId,
      authorType: actorType,
      content,
      type,
      isVerifiedPurchase: req.body.isVerifiedPurchase || false,
    });

    const io = getIo(req);
    if (io) {
      io.to(`product:${productId}`).emit(SOCKET_EVENTS.DISCUSSION_NEW, discussion);
    }

    return res.status(201).json({ status: 201, success: true, data: discussion });
  } catch (err) {
    console.error('createDiscussion error:', err.message);
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
};

const getDiscussions = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page, type } = req.query;

    const result = await discussionService.getDiscussions({
      productId,
      page: parseInt(page, 10) || 1,
      type,
    });

    return res.status(200).json({ status: 200, success: true, data: result });
  } catch (err) {
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
};

const addReply = async (req, res) => {
  try {
    const { discussionId } = req.params;
    const { content } = req.body;
    const { actorId, actorType } = req.community;

    if (!content) {
      return res.status(400).json({ status: 400, success: false, message: 'content is required' });
    }

    const reply = await discussionService.addReply({
      discussionId,
      authorId: actorId,
      authorType: actorType,
      content,
      isVerifiedPurchase: req.body.isVerifiedPurchase || false,
    });

    const io = getIo(req);
    if (io) {
      io.to(`discussion:${discussionId}`).emit(SOCKET_EVENTS.DISCUSSION_REPLIED, reply);
    }

    return res.status(201).json({ status: 201, success: true, data: reply });
  } catch (err) {
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
};

const getReplies = async (req, res) => {
  try {
    const { discussionId } = req.params;
    const result = await discussionService.getReplies({
      discussionId,
      page: parseInt(req.query.page, 10) || 1,
    });
    return res.status(200).json({ status: 200, success: true, data: result });
  } catch (err) {
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
};

const toggleReaction = async (req, res) => {
  try {
    const { targetId } = req.params;
    const { targetType, emoji } = req.body;
    const { actorId, actorType } = req.community;

    if (!targetType || !emoji) {
      return res.status(400).json({ status: 400, success: false, message: 'targetType and emoji are required' });
    }

    const reactions = await discussionService.toggleReaction({
      targetId,
      targetType,
      userId: actorId,
      userType: actorType,
      emoji,
    });

    const io = getIo(req);
    if (io) {
      io.to(`product:${req.body.productId}`).emit(SOCKET_EVENTS.DISCUSSION_REACTION, {
        targetId,
        targetType,
        reactions,
      });
    }

    return res.status(200).json({ status: 200, success: true, data: reactions });
  } catch (err) {
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
};

const pinDiscussion = async (req, res) => {
  try {
    const { discussionId } = req.params;
    const { actorId } = req.community;

    const discussion = await discussionService.pinDiscussion({ discussionId, sellerId: actorId });
    return res.status(200).json({ status: 200, success: true, data: discussion });
  } catch (err) {
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
};

const deleteDiscussion = async (req, res) => {
  try {
    const { discussionId } = req.params;
    const { actorId, actorType } = req.community;

    await discussionService.deleteDiscussion({ discussionId, userId: actorId, userType: actorType });
    return res.status(200).json({ status: 200, success: true, message: 'Discussion removed' });
  } catch (err) {
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
};

const reportContent = async (req, res) => {
  try {
    const { targetId, targetType, reason, note } = req.body;
    const { actorId, actorType } = req.community;

    if (!targetId || !targetType || !reason) {
      return res.status(400).json({ status: 400, success: false, message: 'targetId, targetType, and reason are required' });
    }

    const report = await ModerationReport.create({
      targetId,
      targetType,
      reporterId: actorId,
      reporterType: actorType,
      reason,
      note: note || '',
    });

    return res.status(201).json({ status: 201, success: true, data: report });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ status: 409, success: false, message: 'You have already reported this content' });
    }
    return res.status(400).json({ status: 400, success: false, message: err.message });
  }
};

module.exports = {
  createDiscussion,
  getDiscussions,
  addReply,
  getReplies,
  toggleReaction,
  pinDiscussion,
  deleteDiscussion,
  reportContent,
};
