import express from "express";
import { loadConfig } from "../../shared/config";
import { createLogger } from "../../shared/logger";
import { getPool, closePool } from "../../shared/db";
import { HealthResponse } from "../../shared/types";
import { createRoutes } from "./routes";

const config = loadConfig(3004);
const logger = createLogger("webhook");
const startTime = Date.now();

const app = express();
app.use(express.json());

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
app.use("/", createRoutes(pool, logger));

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, "Webhook service started");
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  server.close();
  await closePool();
  process.exit(0);
});
