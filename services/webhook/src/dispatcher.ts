import { Pool } from "pg";
import { Logger } from "pino";
import * as dns from "dns/promises";
import { SssEvent, WebhookSubscription } from "../../shared/types";
import { isPrivateIp } from "../../shared/validation";
import * as crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

const MAX_RETRIES = 5;
// Backoff schedule per API.md: immediate, 30s, 2m, 10m, 1h
const BACKOFF_DELAYS_MS = [0, 30_000, 120_000, 600_000, 3_600_000];

/**
 * Re-validate the webhook URL's resolved IP at dispatch time to prevent DNS
 * rebinding attacks. The URL was validated at registration time, but the domain
 * could be rebound to a private IP (e.g., 169.254.169.254 for cloud metadata)
 * between registration and delivery.
 */
async function checkDnsRebinding(urlStr: string): Promise<boolean> {
  try {
    const hostname = new URL(urlStr).hostname;
    // Skip for IP literals — already checked at registration
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return false;
    const addresses = await dns.resolve4(hostname);
    return addresses.some(isPrivateIp);
  } catch {
    return false; // DNS failure — let fetch() handle it
  }
}

export async function dispatchEvent(
  pool: Pool,
  logger: Logger,
  event: SssEvent
): Promise<void> {
  const result = await pool.query(
    `SELECT id, url, events, secret, active FROM webhook_subscriptions WHERE active = true`
  );

  const eligible = result.rows.filter((sub: any) => {
    const subscribedEvents = sub.events as string[];
    return subscribedEvents.length === 0 || subscribedEvents.includes(event.name);
  });

  // Dispatch to all subscribers in parallel — one dead subscriber must not
  // block delivery to others
  const results = await Promise.allSettled(
    eligible.map((sub: any) => deliverWithRetry(pool, sub, event, logger))
  );

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "rejected") {
      logger.error(
        { subId: eligible[i].id, err: (results[i] as PromiseRejectedResult).reason },
        "Webhook delivery promise rejected"
      );
    }
  }
}

async function deliverWithRetry(
  pool: Pool,
  sub: any,
  event: SssEvent,
  logger: Logger
): Promise<void> {
  const deliveryId = uuidv4();

  // Re-check DNS at dispatch time to block DNS rebinding attacks (SSRF)
  if (await checkDnsRebinding(sub.url)) {
    logger.warn({ subId: sub.id, url: sub.url }, "DNS rebinding detected — skipping delivery");
    return;
  }

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
  try {
    await pool.query(
      `UPDATE webhook_subscriptions SET active = false WHERE id = $1`,
      [sub.id]
    );
  } catch (dbErr) {
    logger.error({ subId: sub.id, dbErr }, "Failed to deactivate subscription after retry exhaustion");
  }
}
