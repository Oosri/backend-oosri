const returnRequestService = require('../Admin/services/returnRequestService');

module.exports.getMyReturns = async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const skip     = parseInt(req.query.skip)  || 0;
    const limit    = parseInt(req.query.limit) || 15;
    const { status } = req.query;

    const result = await returnRequestService.getSellerReturns({ sellerId, skip, limit, status });
    return res.status(200).json({ status: 200, success: true, body: result });
  } catch (e) {
    console.error('Controller: sellerReturn.getMyReturns', e);
    return res.status(500).json({ status: 500, success: false, message: e.message });
  }
};

module.exports.getReturnById = async (req, res) => {
  try {
    const sellerId  = req.seller._id;
    const requestId = req.params.id;

    const result = await returnRequestService.getSellerReturnById({ requestId, sellerId });
    return res.status(200).json({ status: 200, success: true, body: result });
  } catch (e) {
    console.error('Controller: sellerReturn.getReturnById', e);
    const httpStatus = e.message.includes('not found') || e.message.includes('Not found') ? 404 : 500;
    return res.status(httpStatus).json({ status: httpStatus, success: false, message: e.message });
  }
};

module.exports.approveReturn = async (req, res) => {
  try {
    const sellerId   = req.seller._id;
    const sellerName = [req.seller.firstName, req.seller.lastName].filter(Boolean).join(' ');
    const { note }   = req.body;

    const result = await returnRequestService.sellerApproveReturn({
      requestId: req.params.id,
      sellerId,
      sellerName,
      note,
    });
    return res.status(200).json({ status: 200, success: true, body: result, message: 'Return approved successfully' });
  } catch (e) {
    console.error('Controller: sellerReturn.approveReturn', e);
    const httpStatus = e.message.includes('not found') ? 404 : 400;
    return res.status(httpStatus).json({ status: httpStatus, success: false, message: e.message });
  }
};

module.exports.rejectReturn = async (req, res) => {
  try {
    const sellerId   = req.seller._id;
    const sellerName = [req.seller.firstName, req.seller.lastName].filter(Boolean).join(' ');
    const { note }   = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ status: 400, success: false, message: 'A reason is required to reject a return request' });
    }

    const result = await returnRequestService.sellerRejectReturn({
      requestId: req.params.id,
      sellerId,
      sellerName,
      note: note.trim(),
    });
    return res.status(200).json({ status: 200, success: true, body: result, message: 'Return rejected' });
  } catch (e) {
    console.error('Controller: sellerReturn.rejectReturn', e);
    const httpStatus = e.message.includes('not found') ? 404 : 400;
    return res.status(httpStatus).json({ status: httpStatus, success: false, message: e.message });
  }
};
