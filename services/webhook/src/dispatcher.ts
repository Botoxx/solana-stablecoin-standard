import { Pool } from "pg";
import { Logger } from "pino";
import { SssEvent, WebhookSubscription } from "../../shared/types";
import * as crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

const MAX_RETRIES = 5;
// Backoff schedule per API.md: immediate, 30s, 2m, 10m, 1h
const BACKOFF_DELAYS_MS = [0, 30_000, 120_000, 600_000, 3_600_000];

export async function dispatchEvent(
  pool: Pool,
  logger: Logger,
  event: SssEvent
): Promise<void> {
  const result = await pool.query(
    `SELECT id, url, events, secret, active FROM webhook_subscriptions WHERE active = true`
  );

  for (const sub of result.rows) {
    const subscribedEvents = sub.events as string[];
    if (subscribedEvents.length > 0 && !subscribedEvents.includes(event.name)) {
      continue;
    }

    await deliverWithRetry(pool, sub, event, logger);
  }
}

async function deliverWithRetry(
  pool: Pool,
  sub: any,
  event: SssEvent,
  logger: Logger
): Promise<void> {
  const deliveryId = uuidv4();

  const payload = JSON.stringify({
    id: deliveryId,
    event: event.name,
    timestamp: new Date(event.timestamp).toISOString(),
    signature: event.signature,
    data: {
      authority: event.authority,
      ...event.data,
      timestamp: Math.floor(event.timestamp / 1000),
    },
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Wait before retry (first attempt is immediate)
    if (attempt > 0) {
      const delay = BACKOFF_DELAYS_MS[attempt] ?? BACKOFF_DELAYS_MS[BACKOFF_DELAYS_MS.length - 1];
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-SSS-Event": event.name,
      "X-SSS-Delivery": deliveryId,
    };

    if (sub.secret) {
      const hmac = crypto.createHmac("sha256", sub.secret).update(payload).digest("hex");
      headers["X-SSS-Signature"] = `sha256=${hmac}`;
    }

    try {
      const response = await fetch(sub.url, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        logger.info({ subId: sub.id, event: event.name, deliveryId }, "Webhook delivered");
        return;
      }

      logger.warn(
        { subId: sub.id, status: response.status, attempt },
        "Webhook delivery failed"
      );
    } catch (err) {
      logger.warn({ subId: sub.id, attempt, err }, "Webhook delivery error");
    }
  }

  // All retries exhausted — deactivate subscription
  logger.error(
    { subId: sub.id, event: event.name, deliveryId },
    "Webhook delivery exhausted retries, deactivating subscription"
  );
  await pool.query(
    `UPDATE webhook_subscriptions SET active = false WHERE id = $1`,
    [sub.id]
  );
}
