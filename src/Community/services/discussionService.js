const Discussion = require('../models/discussionModel');
const Reply = require('../models/replyModel');
const {
  DISCUSSION_PAGE_SIZE,
  REPLY_PAGE_SIZE,
  ALLOWED_REACTION_EMOJIS,
} = require('../constants/community');

const createDiscussion = async ({ productId, sellerId, authorId, authorType, content, type, isVerifiedPurchase }) => {
  const discussion = await Discussion.create({
    productId,
    sellerId,
    authorId,
    authorType,
    content,
    type: type || 'discussion',
    isSellerResponse: authorType === 'seller',
    isVerifiedPurchase: !!isVerifiedPurchase,
  });
  return discussion;
};

const getDiscussions = async ({ productId, page = 1, type }) => {
  const query = { productId, status: 'active' };
  if (type) query.type = type;

  const skip = (page - 1) * DISCUSSION_PAGE_SIZE;

  const [pinned, regular, total] = await Promise.all([
    page === 1
      ? Discussion.find({ ...query, isPinned: true })
          .sort({ createdAt: -1 })
          .lean()
      : [],
    Discussion.find({ ...query, isPinned: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(DISCUSSION_PAGE_SIZE)
      .lean(),
    Discussion.countDocuments(query),
  ]);

  return {
    discussions: [...pinned, ...regular],
    total,
    page,
    pages: Math.ceil(total / DISCUSSION_PAGE_SIZE),
  };
};

const getDiscussion = async (discussionId) => {
  const discussion = await Discussion.findOne({ _id: discussionId, status: 'active' }).lean();
  if (!discussion) throw new Error('Discussion not found');
  return discussion;
};

const addReply = async ({ discussionId, productId, authorId, authorType, content, isVerifiedPurchase }) => {
  const discussion = await Discussion.findOne({ _id: discussionId, status: 'active' });
  if (!discussion) throw new Error('Discussion not found');

  const reply = await Reply.create({
    discussionId,
    productId: productId || discussion.productId,
    authorId,
    authorType,
    content,
    isSellerResponse: authorType === 'seller',
    isVerifiedPurchase: !!isVerifiedPurchase,
  });

  await Discussion.findByIdAndUpdate(discussionId, { $inc: { replyCount: 1 } });

  return reply;
};

const getReplies = async ({ discussionId, page = 1 }) => {
  const skip = (page - 1) * REPLY_PAGE_SIZE;

  const [replies, total] = await Promise.all([
    Reply.find({ discussionId, status: 'active' })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(REPLY_PAGE_SIZE)
      .lean(),
    Reply.countDocuments({ discussionId, status: 'active' }),
  ]);

  return {
    replies,
    total,
    page,
    pages: Math.ceil(total / REPLY_PAGE_SIZE),
  };
};

const toggleReaction = async ({ targetId, targetType, userId, userType, emoji }) => {
  if (!ALLOWED_REACTION_EMOJIS.includes(emoji)) {
    throw new Error('Invalid reaction emoji');
  }

  const Model = targetType === 'discussion' ? Discussion : Reply;
  const doc = await Model.findById(targetId);
  if (!doc) throw new Error(`${targetType} not found`);

  const existing = doc.reactions.find(
    (r) => r.userId.toString() === userId.toString() && r.emoji === emoji
  );

  if (existing) {
    doc.reactions = doc.reactions.filter(
      (r) => !(r.userId.toString() === userId.toString() && r.emoji === emoji)
    );
  } else {
    doc.reactions.push({ userId, userType, emoji });
  }

  await doc.save();
  return doc.reactions;
};

const pinDiscussion = async ({ discussionId, sellerId }) => {
  const discussion = await Discussion.findOne({ _id: discussionId, sellerId });
  if (!discussion) throw new Error('Discussion not found or not owned by seller');

  discussion.isPinned = !discussion.isPinned;
  await discussion.save();
  return discussion;
};

const deleteDiscussion = async ({ discussionId, userId, userType }) => {
  const discussion = await Discussion.findById(discussionId);
  if (!discussion) throw new Error('Discussion not found');

  const isOwner = discussion.authorId.toString() === userId.toString();
  const isSeller = userType === 'seller' && discussion.sellerId.toString() === userId.toString();

  if (!isOwner && !isSeller) throw new Error('Not authorised to delete this discussion');

  discussion.status = 'deleted';
  await discussion.save();
};

module.exports = {
  createDiscussion,
  getDiscussions,
  getDiscussion,
  addReply,
  getReplies,
  toggleReaction,
  pinDiscussion,
  deleteDiscussion,
};
