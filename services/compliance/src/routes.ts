import { Router } from "express";
import { Pool } from "pg";
import { Logger } from "pino";
import { logAudit } from "../../shared/audit";
import { ScreeningProvider } from "./screening";
import { isValidPubkey } from "../../shared/validation";

export function createRoutes(
  pool: Pool,
  logger: Logger,
  screener: ScreeningProvider
): Router {
  const router = Router();

  router.get("/blacklist", async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "50") || 50, 1), 1000);
      const offset = Math.max(parseInt((req.query.offset as string) || "0") || 0, 0);

      const result = await pool.query(
        `SELECT address, reason, blacklisted_by, blacklisted_at, active
         FROM blacklist ORDER BY blacklisted_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      res.json(result.rows);
    } catch (err: any) {
      logger.error({ err }, "Failed to list blacklist");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/blacklist", async (req, res) => {
    try {
      const { address, reason, operator } = req.body;
      if (!address || !reason) {
        return res.status(400).json({ error: "Missing address or reason" });
      }
      if (!isValidPubkey(String(address))) {
        return res.status(400).json({ error: "Invalid address — must be a valid Solana public key" });
      }

      await pool.query(
        `INSERT INTO blacklist (address, reason, blacklisted_by, active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (address) DO UPDATE SET active = true, reason = $2, blacklisted_by = $3`,
        [address, reason, operator || "system"]
      );

      await logAudit(pool, {
        action: "blacklist_add",
        operator: operator || "system",
        target: address,
        details: { reason },
      });

      logger.info({ address, reason }, "Address blacklisted");
      res.status(201).json({ address, status: "blacklisted" });
    } catch (err: any) {
      logger.error({ err }, "Failed to blacklist");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.delete("/blacklist/:address", async (req, res) => {
    try {
      await pool.query(
        `UPDATE blacklist SET active = false WHERE address = $1`,
        [req.params.address]
      );

      await logAudit(pool, {
        action: "blacklist_remove",
        operator: "system",
        target: req.params.address,
      });

      logger.info({ address: req.params.address }, "Address removed from blacklist");
      res.json({ address: req.params.address, status: "removed" });
    } catch (err: any) {
      logger.error({ err }, "Failed to remove from blacklist");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/screen", async (req, res) => {
    try {
      const { address } = req.body;
      if (!address) return res.status(400).json({ error: "Missing address" });
      if (!isValidPubkey(String(address))) {
        return res.status(400).json({ error: "Invalid address — must be a valid Solana public key" });
      }

      const result = await screener.screen(address);

      await logAudit(pool, {
        action: "screen",
        operator: "system",
        target: address,
        details: { flagged: result.flagged, source: result.source },
      });

      logger.info({ address, flagged: result.flagged }, "Address screened");
      res.json(result);
    } catch (err: any) {
      logger.error({ err }, "Screening failed");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/audit-log", async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "100") || 100, 1), 1000);
      const offset = Math.max(parseInt((req.query.offset as string) || "0") || 0, 0);
      const action = req.query.action as string | undefined;

      let query = `SELECT * FROM audit_log`;
      const params: any[] = [];
      let idx = 1;

      if (action) {
        query += ` WHERE action = $${idx++}`;
        params.push(action);
      }

      query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: any) {
      logger.error({ err }, "Failed to fetch audit log");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
