import { SssEvent } from "../../shared/types";

const EVENT_NAMES = [
  "InitializeEvent",
  "MintEvent",
  "BurnEvent",
  "FreezeEvent",
  "ThawEvent",
  "PauseEvent",
  "UnpauseEvent",
  "MinterUpdatedEvent",
  "RoleUpdatedEvent",
  "AuthorityProposedEvent",
  "AuthorityAcceptedEvent",
  "BlacklistAddEvent",
  "BlacklistRemoveEvent",
  "SeizeEvent",
];

export function parseTransactionLogs(
  signature: string,
  slot: number,
  logs: string[]
): SssEvent[] {
  const events: SssEvent[] = [];

  for (const log of logs) {
    if (!log.startsWith("Program data:")) continue;

    const base64Data = log.slice("Program data: ".length).trim();
    try {
      const buffer = Buffer.from(base64Data, "base64");
      // Anchor event discriminator is first 8 bytes (sha256 of "event:<Name>")
      // We store raw data and attempt to match known event names
      const discriminator = buffer.slice(0, 8).toString("hex");

      events.push({
        name: identifyEvent(discriminator) || "Unknown",
        authority: "",
        timestamp: Date.now(),
        signature,
        slot,
        data: { raw: base64Data, discriminator },
      });
    } catch {
      // Skip unparseable logs
    }
  }

  return events;
}

const EVENT_DISCRIMINATORS: Record<string, string> = {};

function identifyEvent(discriminator: string): string | null {
  return EVENT_DISCRIMINATORS[discriminator] || null;
}

export function initEventDiscriminators(): void {
  const crypto = require("crypto");
  for (const name of EVENT_NAMES) {
    const hash = crypto
      .createHash("sha256")
      .update(`event:${name}`)
      .digest();
    const disc = hash.slice(0, 8).toString("hex");
    EVENT_DISCRIMINATORS[disc] = name;
  }
}
