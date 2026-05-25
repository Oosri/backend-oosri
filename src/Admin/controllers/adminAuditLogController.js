const AdminAuditLog = require('../Model/adminAuditLogModel');
const constants = require('../constants');

module.exports.getAuditLogs = async (req, res) => {
  const response = { ...constants.customServerResponse };
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const skip  = (page - 1) * limit;

    const query = {};
    if (req.query.action)  query.action  = req.query.action;
    if (req.query.adminId) query.adminId = req.query.adminId;
    if (req.query.entity)  query.entity  = req.query.entity;
    if (req.query.status)  query.status  = req.query.status;
    if (req.query.from || req.query.to) {
      query.createdAt = {};
      if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
      if (req.query.to)   query.createdAt.$lte = new Date(req.query.to);
    }

    const [total, logs] = await Promise.all([
      AdminAuditLog.countDocuments(query),
      AdminAuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    response.status = 200;
    response.message = constants.auditLogMessage.LOGS_FETCHED;
    response.body = {
      logs,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  } catch (error) {
    console.error('Something went wrong: Controller: getAuditLogs', error);
    response.status = 500;
    response.message = constants.auditLogMessage.LOGS_FETCH_ERROR;
  }
  return res.status(response.status).json(response);
};
