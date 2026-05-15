const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    adminId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    adminEmail: { type: String, required: true },
    action:     { type: String, required: true, index: true },
    entity:     { type: String },
    entityId:   { type: String },
    details:    { type: mongoose.Schema.Types.Mixed },
    ip:         { type: String },
    userAgent:  { type: String },
    status:     { type: String, enum: ['success', 'failure'], default: 'success' },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', auditLogSchema);
