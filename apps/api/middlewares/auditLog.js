import AuditLog from '../models/AuditLog.js';

/**
 * Write an audit log entry for financial mutations
 */
export async function writeAuditLog({ action, subjectType, subjectId, before = null, after = null, userId = null }) {
  try {
    await AuditLog.create({
      action,
      subject_type: subjectType,
      subject_id: String(subjectId),
      changes: { before, after },
      user_id: userId,
    });
  } catch (err) {
    // Audit log failures should not break the request
    console.error('Audit log write failed:', err.message);
  }
}

/**
 * Middleware factory — wraps route handler to auto-log mutations
 */
export function auditMiddleware(action, subjectType) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300 && res.locals.auditSubjectId) {
        writeAuditLog({
          action,
          subjectType,
          subjectId: res.locals.auditSubjectId,
          before: res.locals.auditBefore,
          after: res.locals.auditAfter,
        });
      }
    });
    next();
  };
}
