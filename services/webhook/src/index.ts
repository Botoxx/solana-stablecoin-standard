import express from "express";
import { loadConfig } from "../../shared/config";
import { createLogger } from "../../shared/logger";
import { getPool, closePool } from "../../shared/db";
import { authMiddleware } from "../../shared/auth";
import { HealthResponse, SssEvent } from "../../shared/types";
import { createRoutes } from "./routes";
import { dispatchEvent } from "./dispatcher";

const config = loadConfig(3004);
const logger = createLogger("webhook");
const startTime = Date.now();

const app = express();
app.use(express.json({ limit: "10kb" }));

app.get("/health", (_req, res) => {
  const health: HealthResponse = {
    status: "ok",
    service: "webhook",
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
  };
  res.json(health);
});

const pool = getPool(config.postgresUrl);

// Internal endpoint called by indexer to dispatch events to webhook subscribers
app.post("/dispatch", authMiddleware, async (req, res) => {
  try {
    const event = req.body as SssEvent;
    if (!event.name) {
      return res.status(400).json({ error: "Missing event name" });
    }
    await dispatchEvent(pool, logger, event);
    res.json({ dispatched: true, event: event.name });
  } catch (err: any) {
    logger.error({ err }, "Failed to dispatch event");
    res.status(500).json({ error: "Internal server error" });
  }
});

app.use(authMiddleware);
app.use("/", createRoutes(pool, logger));

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, "Webhook service started");
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closePool();
  process.exit(0);
});
