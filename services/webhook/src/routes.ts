import { Router } from "express";
import { Pool } from "pg";
import { Logger } from "pino";
import { v4 as uuidv4 } from "uuid";
import { isValidWebhookUrl } from "../../shared/validation";

export function createRoutes(pool: Pool, logger: Logger): Router {
  const router = Router();

  router.get("/subscriptions", async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, url, events, active, created_at FROM webhook_subscriptions ORDER BY created_at DESC`
      );
      res.json(result.rows);
    } catch (err: any) {
      logger.error({ err }, "Failed to list subscriptions");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/subscriptions", async (req, res) => {
    try {
      const { url, events, secret } = req.body;
      if (!url) return res.status(400).json({ error: "Missing url" });

      const urlCheck = isValidWebhookUrl(url);
      if (!urlCheck.valid) {
        return res.status(400).json({ error: urlCheck.reason });
      }

      const id = uuidv4();
      await pool.query(
        `INSERT INTO webhook_subscriptions (id, url, events, secret, active)
         VALUES ($1, $2, $3, $4, true)`,
        [id, url, events || [], secret || null]
      );

      logger.info({ id, url }, "Webhook subscription created");
      res.status(201).json({ id, url, events: events || [], active: true });
    } catch (err: any) {
      logger.error({ err }, "Failed to create subscription");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.delete("/subscriptions/:id", async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM webhook_subscriptions WHERE id = $1 RETURNING id`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      logger.info({ id: req.params.id }, "Webhook subscription deleted");
      res.json({ deleted: true });
    } catch (err: any) {
      logger.error({ err }, "Failed to delete subscription");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
