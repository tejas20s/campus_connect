export function writeAuditLog(transaction, { actorId, action, resourceType, resourceId, details }) {
  return transaction.auditLog.create({
    data: {
      actorId,
      action,
      resourceType,
      resourceId,
      details
    }
  });
}
