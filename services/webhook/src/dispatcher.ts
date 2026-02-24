import { Pool } from "pg";
import { Logger } from "pino";
import { SssEvent, WebhookSubscription } from "../../shared/types";
import * as crypto from "crypto";

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

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

    await deliverWithRetry(sub, event, logger);
  }
}

async function deliverWithRetry(
  sub: any,
  event: SssEvent,
  logger: Logger
): Promise<void> {
  const payload = JSON.stringify({
    event: event.name,
    data: event.data,
    signature: event.signature,
    timestamp: event.timestamp,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (sub.secret) {
    const hmac = crypto.createHmac("sha256", sub.secret).update(payload).digest("hex");
    headers["X-SSS-Signature"] = hmac;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(sub.url, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        logger.info({ subId: sub.id, event: event.name }, "Webhook delivered");
        return;
      }

      logger.warn(
        { subId: sub.id, status: response.status, attempt },
        "Webhook delivery failed"
      );
    } catch (err) {
      logger.warn({ subId: sub.id, attempt, err }, "Webhook delivery error");
    }

    if (attempt < MAX_RETRIES - 1) {
      const delay = BACKOFF_BASE_MS * Math.pow(4, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  logger.error({ subId: sub.id, event: event.name }, "Webhook delivery exhausted retries");
}
