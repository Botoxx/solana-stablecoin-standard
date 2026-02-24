import express from "express";
import { loadConfig } from "../../shared/config";
import { createLogger } from "../../shared/logger";
import { getPool, closePool } from "../../shared/db";
import { HealthResponse } from "../../shared/types";
import { createRoutes } from "./routes";
import { OFACScreeningProvider } from "./screening";

const config = loadConfig(3003);
const logger = createLogger("compliance");
const startTime = Date.now();

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  const health: HealthResponse = {
    status: "ok",
    service: "compliance",
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
  };
  res.json(health);
});

const pool = getPool(config.postgresUrl);
const screener = new OFACScreeningProvider();
app.use("/", createRoutes(pool, logger, screener));

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, "Compliance service started");
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  server.close();
  await closePool();
  process.exit(0);
});
