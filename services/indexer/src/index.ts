import express from "express";
import { Connection } from "@solana/web3.js";
import { loadConfig } from "../../shared/config";
import { createLogger } from "../../shared/logger";
import { getPool, closePool } from "../../shared/db";
import { logAudit } from "../../shared/audit";
import { authMiddleware } from "../../shared/auth";
import { HealthResponse, SssEvent } from "../../shared/types";
import { parseTransactionLogs, initEventDiscriminators } from "./parser";
import { storeEvent } from "./store";

const config = loadConfig(3001);
const logger = createLogger("indexer");
const startTime = Date.now();
const webhookUrl = process.env.WEBHOOK_URL || "http://webhook:3004";

const app = express();
app.use(express.json({ limit: "10kb" }));

app.get("/health", (_req, res) => {
  const health: HealthResponse = {
    status: "ok",
    service: "indexer",
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
  };
  res.json(health);
});

app.get("/events", authMiddleware, async (req, res) => {
  try {
    const pool = getPool(config.postgresUrl);
    const { getEvents } = await import("./store");
    const events = await getEvents(pool, {
      name: req.query.name as string | undefined,
      limit: Math.min(Math.max(parseInt((req.query.limit as string) || "100") || 100, 1), 1000),
      offset: Math.max(parseInt((req.query.offset as string) || "0") || 0, 0),
    });
    res.json(events);
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch events");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function dispatchToWebhook(event: SssEvent): Promise<void> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const apiSecret = process.env.API_SECRET;
    if (apiSecret) {
      headers["Authorization"] = `Bearer ${apiSecret}`;
    }
    const response = await fetch(`${webhookUrl}/dispatch`, {
      method: "POST",
      headers,
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
  const pool = getPool(config.postgresUrl);
  initEventDiscriminators();

  const programId = config.programId;
  const { PublicKey: PK } = await import("@solana/web3.js");

  function subscribe() {
    const connection = new Connection(config.rpcUrl, "confirmed");
    logger.info({ programId }, "Subscribing to program logs");

    const subId = connection.onLogs(
      new PK(programId),
      async (logInfo) => {
        const events = parseTransactionLogs(
          logInfo.signature,
          0,
          logInfo.logs
        );
        // Process each event independently — a failure on one event must not
        // prevent processing of subsequent events in the same transaction
        for (const event of events) {
          // Skip dispatching Unknown events to avoid polluting subscriber feeds
          if (event.name === "Unknown") {
            logger.warn({ sig: logInfo.signature, disc: event.data?.discriminator }, "Unknown event discriminator");
            continue;
          }
          try {
            await storeEvent(pool, event);
            logger.info({ event: event.name, sig: logInfo.signature }, "Indexed event");

            await logAudit(pool, {
              action: event.name,
              operator: event.authority || "system",
              details: event.data,
              signature: event.signature,
            });

            await dispatchToWebhook(event);
          } catch (err) {
            logger.error(
              { err, sig: logInfo.signature, event: event.name },
              "Failed to process event"
            );
          }
        }
      },
      "confirmed"
    );

    // Reconnect on WebSocket close — onLogs uses a WebSocket subscription
    // that can drop silently. Poll to detect stale connections.
    const healthCheck = setInterval(async () => {
      try {
        await connection.getSlot();
      } catch {
        logger.warn("WebSocket health check failed — reconnecting");
        clearInterval(healthCheck);
        try { connection.removeOnLogsListener(subId); } catch { /* already dead */ }
        setTimeout(subscribe, 3000);
      }
    }, 30_000);
  }

  subscribe();
}

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, "Indexer service started");
  startSubscription().catch((err) => {
    logger.error({ err }, "Failed to start subscription — exiting");
    process.exit(1);
  });
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closePool();
  process.exit(0);
});
