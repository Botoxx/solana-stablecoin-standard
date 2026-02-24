import { Router } from "express";
import { Pool } from "pg";
import { Logger } from "pino";
import { ScreeningProvider } from "./screening";

export function createRoutes(
  pool: Pool,
  logger: Logger,
  screener: ScreeningProvider
): Router {
  const router = Router();

  router.get("/blacklist", async (req, res) => {
    try {
      const limit = parseInt((req.query.limit as string) || "50");
      const offset = parseInt((req.query.offset as string) || "0");

      const result = await pool.query(
        `SELECT address, reason, blacklisted_by, blacklisted_at, active
         FROM blacklist ORDER BY blacklisted_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      res.json(result.rows);
    } catch (err: any) {
      logger.error({ err }, "Failed to list blacklist");
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/blacklist", async (req, res) => {
    try {
      const { address, reason, operator } = req.body;
      if (!address || !reason) {
        return res.status(400).json({ error: "Missing address or reason" });
      }

      await pool.query(
        `INSERT INTO blacklist (address, reason, blacklisted_by, active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (address) DO UPDATE SET active = true, reason = $2, blacklisted_by = $3`,
        [address, reason, operator || "system"]
      );

      logger.info({ address, reason }, "Address blacklisted");
      res.status(201).json({ address, status: "blacklisted" });
    } catch (err: any) {
      logger.error({ err }, "Failed to blacklist");
      res.status(500).json({ error: err.message });
    }
  });

  router.delete("/blacklist/:address", async (req, res) => {
    try {
      await pool.query(
        `UPDATE blacklist SET active = false WHERE address = $1`,
        [req.params.address]
      );
      logger.info({ address: req.params.address }, "Address removed from blacklist");
      res.json({ address: req.params.address, status: "removed" });
    } catch (err: any) {
      logger.error({ err }, "Failed to remove from blacklist");
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/screen", async (req, res) => {
    try {
      const { address } = req.body;
      if (!address) return res.status(400).json({ error: "Missing address" });

      const result = await screener.screen(address);
      logger.info({ address, flagged: result.flagged }, "Address screened");
      res.json(result);
    } catch (err: any) {
      logger.error({ err }, "Screening failed");
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/audit-log", async (req, res) => {
    try {
      const limit = parseInt((req.query.limit as string) || "100");
      const offset = parseInt((req.query.offset as string) || "0");
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
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
