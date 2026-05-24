const adminReviewService = require('../services/adminReviewService');
const constants = require('../constants');

module.exports.getAllReviews = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { status } = req.query;

    response.body = await adminReviewService.listAllReviews({ status, page, limit });
    response.status = 200;
    response.message = constants.adminReviewMessage.REVIEWS_FETCHED;
  } catch (error) {
    console.error('Controller: adminReview.getAllReviews', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};

module.exports.moderateReview = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    const adminId = req.adminUser._id;
    const { status } = req.body;

    response.body = await adminReviewService.moderateReview({
      id: req.params.id,
      status,
      adminId,
    });
    response.status = 200;
    response.message = constants.adminReviewMessage.REVIEW_MODERATED;
  } catch (error) {
    console.error('Controller: adminReview.moderateReview', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};

module.exports.deleteReview = async (req, res) => {
  let response = { ...constants.customServerResponse };
  try {
    response.body = await adminReviewService.deleteReview({ id: req.params.id });
    response.status = 200;
    response.message = constants.adminReviewMessage.REVIEW_DELETED;
  } catch (error) {
    console.error('Controller: adminReview.deleteReview', error);
    response.message = error.message;
  }
  return res.status(response.status).json(response);
};
