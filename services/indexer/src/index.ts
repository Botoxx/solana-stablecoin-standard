import express from "express";
import { Connection } from "@solana/web3.js";
import { loadConfig } from "../../shared/config";
import { createLogger } from "../../shared/logger";
import { getPool, closePool } from "../../shared/db";
import { logAudit } from "../../shared/audit";
import { HealthResponse, SssEvent } from "../../shared/types";
import { parseTransactionLogs, initEventDiscriminators } from "./parser";
import { storeEvent } from "./store";

const config = loadConfig(3001);
const logger = createLogger("indexer");
const startTime = Date.now();
const webhookUrl = process.env.WEBHOOK_URL || "http://webhook:3004";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  const health: HealthResponse = {
    status: "ok",
    service: "indexer",
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
  };
  res.json(health);
});

app.get("/events", async (req, res) => {
  try {
    const pool = getPool(config.postgresUrl);
    const { getEvents } = await import("./store");
    const events = await getEvents(pool, {
      name: req.query.name as string | undefined,
      limit: parseInt((req.query.limit as string) || "100"),
      offset: parseInt((req.query.offset as string) || "0"),
    });
    res.json(events);
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch events");
    res.status(500).json({ error: err.message });
  }
});

async function dispatchToWebhook(event: SssEvent): Promise<void> {
  try {
    const response = await fetch(`${webhookUrl}/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      logger.warn({ status: response.status, event: event.name }, "Webhook dispatch non-ok");
    }
  } catch (err) {
    logger.warn({ err, event: event.name }, "Webhook dispatch failed (non-fatal)");
  }
}

async function startSubscription() {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const pool = getPool(config.postgresUrl);

  initEventDiscriminators();

  const programId = config.programId;
  logger.info({ programId }, "Subscribing to program logs");

  const { PublicKey: PK } = await import("@solana/web3.js");
  connection.onLogs(
    new PK(programId),
    async (logInfo) => {
      try {
        const events = parseTransactionLogs(
          logInfo.signature,
          0,
          logInfo.logs
        );
        for (const event of events) {
          await storeEvent(pool, event);
          logger.info({ event: event.name, sig: logInfo.signature }, "Indexed event");

          await logAudit(pool, {
            action: event.name,
            operator: event.authority || "system",
            details: event.data,
            signature: event.signature,
          });

          await dispatchToWebhook(event);
        }
      } catch (err) {
        logger.error({ err, sig: logInfo.signature }, "Failed to process log");
      }
    },
    "confirmed"
  );
}

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, "Indexer service started");
  startSubscription().catch((err) => {
    logger.error({ err }, "Failed to start subscription");
  });
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  server.close();
  await closePool();
  process.exit(0);
});
