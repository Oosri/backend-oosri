const AdminAuditLog = require('../Model/adminAuditLogModel');

/**
 * Middleware factory that records an audit log entry after the handler responds.
 *
 * Usage:
 *   router.patch('/buyers/:id/suspend', adminAuth, auditLog('SUSPEND_BUYER', 'Buyer', 'id'), controller);
 *
 * @param {string} action      - Machine-readable action name (e.g. 'APPROVE_PAYOUT')
 * @param {string} [entity]    - The resource type being acted on (e.g. 'Buyer', 'Payout')
 * @param {string} [paramKey]  - req.params key whose value is the entity ID (optional)
 */
const auditLog = (action, entity = null, paramKey = null) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      const succeeded = res.statusCode >= 200 && res.statusCode < 300;

      // Fire-and-forget — never block the response
      setImmediate(async () => {
        try {
          const admin = req.admin || req.user;
          if (!admin) return;

          await AdminAuditLog.create({
            adminId:    admin._id || admin.id,
            adminEmail: admin.email,
            action,
            entity:     entity || undefined,
            entityId:   paramKey ? req.params[paramKey] : undefined,
            details:    buildDetails(req),
            ip:         req.ip || req.headers['x-forwarded-for'],
            userAgent:  req.headers['user-agent'],
            status:     succeeded ? 'success' : 'failure',
          });
        } catch (_) {
          // Audit log must never crash the request
        }
      });

      return originalJson(body);
    };

    next();
  };
};

function buildDetails(req) {
  const details = {};
  if (req.body && Object.keys(req.body).length) {
    // Omit sensitive fields
    const { password, newPassword, confirmPassword, token, refreshToken, ...safe } = req.body;
    if (Object.keys(safe).length) details.body = safe;
  }
  if (req.query && Object.keys(req.query).length) details.query = req.query;
  return Object.keys(details).length ? details : undefined;
}

module.exports = auditLog;
