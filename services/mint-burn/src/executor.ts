import { Pool } from "pg";
import { Logger } from "pino";

export async function processPendingRequests(
  pool: Pool,
  logger: Logger
): Promise<void> {
  const result = await pool.query(
    `UPDATE mint_burn_requests
     SET status = 'processing', updated_at = NOW()
     WHERE id = (
       SELECT id FROM mint_burn_requests
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`
  );

  if (result.rows.length === 0) return;

  const request = result.rows[0];
  logger.info({ id: request.id, action: request.action }, "Processing request");

  try {
    // In production, this would use the SDK to execute the mint/burn
    // For now, we mark as completed with a placeholder
    // The actual execution would:
    // 1. Load the stablecoin via SolanaStablecoin.load()
    // 2. Call mintTokens() or burn() with the authority keypair
    // 3. Record the transaction signature

    await pool.query(
      `UPDATE mint_burn_requests
       SET status = 'completed', signature = $1, updated_at = NOW()
       WHERE id = $2`,
      [`placeholder_${request.id}`, request.id]
    );

    logger.info({ id: request.id }, "Request completed");
  } catch (err: any) {
    await pool.query(
      `UPDATE mint_burn_requests
       SET status = 'failed', error = $1, updated_at = NOW()
       WHERE id = $2`,
      [err.message, request.id]
    );
    logger.error({ id: request.id, err }, "Request failed");
  }
}

export function startExecutor(pool: Pool, logger: Logger, intervalMs = 5000) {
  const timer = setInterval(async () => {
    try {
      await processPendingRequests(pool, logger);
    } catch (err) {
      logger.error({ err }, "Executor error");
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
