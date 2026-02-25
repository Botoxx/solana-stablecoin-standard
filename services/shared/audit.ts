import { Pool } from "pg";

export interface AuditEntry {
  action: string;
  operator: string;
  target?: string;
  details?: Record<string, any>;
  signature?: string;
}

export async function logAudit(pool: Pool, entry: AuditEntry): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (action, operator, target, details, signature)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      entry.action,
      entry.operator,
      entry.target || null,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.signature || null,
    ]
  );
}
