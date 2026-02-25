import { Router } from "express";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { MintBurnRequest } from "../../shared/types";
import { logAudit } from "../../shared/audit";
import { Logger } from "pino";
import { isValidPubkey, isValidAmount } from "../../shared/validation";

export function createRoutes(pool: Pool, logger: Logger): Router {
  const router = Router();

  router.post("/mint", async (req, res) => {
    try {
      const { amount, recipient, configPda } = req.body;
      if (!amount || !recipient || !configPda) {
        return res.status(400).json({ error: "Missing amount, recipient, or configPda" });
      }
      if (!isValidAmount(String(amount))) {
        return res.status(400).json({ error: "Invalid amount — must be a positive integer within u64 range" });
      }
      if (!isValidPubkey(String(recipient))) {
        return res.status(400).json({ error: "Invalid recipient — must be a valid Solana public key" });
      }
      if (!isValidPubkey(String(configPda))) {
        return res.status(400).json({ error: "Invalid configPda — must be a valid Solana public key" });
      }

      const id = uuidv4();
      await pool.query(
        `INSERT INTO mint_burn_requests (id, action, amount, recipient, config_pda, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, "mint", amount, recipient, configPda, "pending"]
      );

      await logAudit(pool, {
        action: "mint_request",
        operator: "api",
        target: recipient,
        details: { amount, configPda, requestId: id },
      });

      logger.info({ id, action: "mint", amount, recipient }, "Mint request queued");
      res.status(201).json({ id, status: "pending" });
    } catch (err: any) {
      logger.error({ err }, "Failed to create mint request");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/burn", async (req, res) => {
    try {
      const { amount, tokenAccount, configPda } = req.body;
      if (!amount || !tokenAccount || !configPda) {
        return res.status(400).json({ error: "Missing amount, tokenAccount, or configPda" });
      }
      if (!isValidAmount(String(amount))) {
        return res.status(400).json({ error: "Invalid amount — must be a positive integer within u64 range" });
      }
      if (!isValidPubkey(String(tokenAccount))) {
        return res.status(400).json({ error: "Invalid tokenAccount — must be a valid Solana public key" });
      }
      if (!isValidPubkey(String(configPda))) {
        return res.status(400).json({ error: "Invalid configPda — must be a valid Solana public key" });
      }

      const id = uuidv4();
      await pool.query(
        `INSERT INTO mint_burn_requests (id, action, amount, token_account, config_pda, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, "burn", amount, tokenAccount, configPda, "pending"]
      );

      await logAudit(pool, {
        action: "burn_request",
        operator: "api",
        target: tokenAccount,
        details: { amount, configPda, requestId: id },
      });

      logger.info({ id, action: "burn", amount }, "Burn request queued");
      res.status(201).json({ id, status: "pending" });
    } catch (err: any) {
      logger.error({ err }, "Failed to create burn request");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/requests/:id", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, action, amount, recipient, token_account, status, signature, error, created_at, updated_at
         FROM mint_burn_requests WHERE id = $1`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Request not found" });
      }

      res.json(result.rows[0]);
    } catch (err: any) {
      logger.error({ err }, "Failed to fetch request");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/requests", async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "50") || 50, 1), 1000);
      const offset = Math.max(parseInt((req.query.offset as string) || "0") || 0, 0);

      const result = await pool.query(
        `SELECT id, action, amount, status, signature, created_at
         FROM mint_burn_requests ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      res.json(result.rows);
    } catch (err: any) {
      logger.error({ err }, "Failed to list requests");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
