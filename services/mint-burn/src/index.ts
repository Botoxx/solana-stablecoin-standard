import express from "express";
import { loadConfig } from "../../shared/config";
import { createLogger } from "../../shared/logger";
import { getPool, closePool } from "../../shared/db";
import { authMiddleware } from "../../shared/auth";
import { HealthResponse } from "../../shared/types";
import { createRoutes } from "./routes";
import { startExecutor } from "./executor";

const config = loadConfig(3002);
const logger = createLogger("mint-burn");
const startTime = Date.now();

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  const health: HealthResponse = {
    status: "ok",
    service: "mint-burn",
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
  };
  res.json(health);
});

const pool = getPool(config.postgresUrl);
app.use(authMiddleware);
app.use("/", createRoutes(pool, logger));

let stopExecutor: (() => void) | null = null;

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, "Mint-burn service started");
  if (process.env.AUTHORITY_KEYPAIR) {
    stopExecutor = startExecutor(pool, logger, config.rpcUrl, config.programId);
  } else {
    logger.warn("AUTHORITY_KEYPAIR not set — executor disabled (queue-only mode)");
  }
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  if (stopExecutor) stopExecutor();
  server.close();
  await closePool();
  process.exit(0);
});
