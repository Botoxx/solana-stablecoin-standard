import { SssEvent } from "../../shared/types";
import * as crypto from "crypto";
import { PublicKey } from "@solana/web3.js";

// Lazy logger — use pino if available (production), fall back to console (tests)
let logger: { warn: (obj: any, msg?: string) => void };
try {
  const { createLogger } = require("../../shared/logger");
  logger = createLogger("parser");
} catch {
  logger = { warn: (obj: any, msg?: string) => console.warn("[parser]", msg ?? "", obj) };
}

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

// --- Borsh reader ---

class BorshReader {
  private offset = 0;
  constructor(private buf: Buffer, startOffset = 0) {
    this.offset = startOffset;
  }

  readPubkey(): string {
    const bytes = this.buf.slice(this.offset, this.offset + 32);
    this.offset += 32;
    return new PublicKey(bytes).toBase58();
  }

  readU64(): string {
    const lo = this.buf.readUInt32LE(this.offset);
    const hi = this.buf.readUInt32LE(this.offset + 4);
    this.offset += 8;
    return (BigInt(hi) * BigInt(0x100000000) + BigInt(lo)).toString();
  }

  readI64(): number {
    const val = this.buf.readBigInt64LE(this.offset);
    this.offset += 8;
    return Number(val);
  }

  readU8(): number {
    return this.buf.readUInt8(this.offset++);
  }

  readBool(): boolean {
    return this.readU8() !== 0;
  }

  readString(): string {
    const len = this.buf.readUInt32LE(this.offset);
    this.offset += 4;
    const str = this.buf.slice(this.offset, this.offset + len).toString("utf-8");
    this.offset += len;
    return str;
  }
}

// --- Event decoders ---

type EventDecoder = (r: BorshReader) => { authority: string; data: Record<string, any>; timestamp: number };

const DECODERS: Record<string, EventDecoder> = {
  InitializeEvent(r) {
    const authority = r.readPubkey();
    const mint = r.readPubkey();
    const treasury = r.readPubkey();
    const decimals = r.readU8();
    const enable_permanent_delegate = r.readBool();
    const enable_transfer_hook = r.readBool();
    const default_account_frozen = r.readBool();
    const timestamp = r.readI64();
    return { authority, timestamp, data: { mint, treasury, decimals, enable_permanent_delegate, enable_transfer_hook, default_account_frozen } };
  },
  MintEvent(r) {
    const authority = r.readPubkey();
    const minter = r.readPubkey();
    const recipient = r.readPubkey();
    const amount = r.readU64();
    const remaining_quota = r.readU64();
    const timestamp = r.readI64();
    return { authority, timestamp, data: { minter, recipient, amount, remaining_quota } };
  },
  BurnEvent(r) {
    const authority = r.readPubkey();
    const burner = r.readPubkey();
    const amount = r.readU64();
    const timestamp = r.readI64();
    return { authority, timestamp, data: { burner, amount } };
  },
  FreezeEvent(r) {
    const authority = r.readPubkey();
    const account = r.readPubkey();
    const timestamp = r.readI64();
    return { authority, timestamp, data: { account } };
  },
  ThawEvent(r) {
    const authority = r.readPubkey();
    const account = r.readPubkey();
    const timestamp = r.readI64();
    return { authority, timestamp, data: { account } };
  },
  PauseEvent(r) {
    const authority = r.readPubkey();
    const timestamp = r.readI64();
    return { authority, timestamp, data: {} };
  },
  UnpauseEvent(r) {
    const authority = r.readPubkey();
    const timestamp = r.readI64();
    return { authority, timestamp, data: {} };
  },
  MinterUpdatedEvent(r) {
    const authority = r.readPubkey();
    const minter = r.readPubkey();
    const quota_total = r.readU64();
    const quota_remaining = r.readU64();
    const action = r.readString();
    const timestamp = r.readI64();
    return { authority, timestamp, data: { minter, quota_total, quota_remaining, action } };
  },
  RoleUpdatedEvent(r) {
    const authority = r.readPubkey();
    const address = r.readPubkey();
    const role = r.readU8();
    const action = r.readString();
    const timestamp = r.readI64();
    return { authority, timestamp, data: { address, role, action } };
  },
  AuthorityProposedEvent(r) {
    const authority = r.readPubkey();
    const proposed = r.readPubkey();
    const timestamp = r.readI64();
    return { authority, timestamp, data: { proposed } };
  },
  AuthorityAcceptedEvent(r) {
    const old_authority = r.readPubkey();
    const new_authority = r.readPubkey();
    const timestamp = r.readI64();
    return { authority: old_authority, timestamp, data: { old_authority, new_authority } };
  },
  BlacklistAddEvent(r) {
    const authority = r.readPubkey();
    const address = r.readPubkey();
    const reason = r.readString();
    const timestamp = r.readI64();
    return { authority, timestamp, data: { address, reason } };
  },
  BlacklistRemoveEvent(r) {
    const authority = r.readPubkey();
    const address = r.readPubkey();
    const timestamp = r.readI64();
    return { authority, timestamp, data: { address } };
  },
  SeizeEvent(r) {
    const authority = r.readPubkey();
    const source = r.readPubkey();
    const treasury = r.readPubkey();
    const amount = r.readU64();
    const timestamp = r.readI64();
    return { authority, timestamp, data: { source, treasury, amount } };
  },
};

// --- Discriminator map ---

const EVENT_DISCRIMINATORS: Record<string, string> = {};

export function initEventDiscriminators(): void {
  for (const name of EVENT_NAMES) {
    const hash = crypto.createHash("sha256").update(`event:${name}`).digest();
    const disc = hash.slice(0, 8).toString("hex");
    EVENT_DISCRIMINATORS[disc] = name;
  }
}

// --- Parser entry point ---

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
      const discriminator = buffer.slice(0, 8).toString("hex");
      const name = EVENT_DISCRIMINATORS[discriminator];

      if (!name) {
        events.push({
          name: "Unknown",
          authority: "",
          timestamp: Date.now(),
          signature,
          slot,
          data: { raw: base64Data, discriminator },
        });
        continue;
      }

      const decoder = DECODERS[name];
      if (!decoder) {
        events.push({ name, authority: "", timestamp: Date.now(), signature, slot, data: { raw: base64Data } });
        continue;
      }

      const reader = new BorshReader(buffer, 8); // skip 8-byte discriminator
      const { authority, timestamp, data } = decoder(reader);
      events.push({ name, authority, timestamp: timestamp * 1000, signature, slot, data });
    } catch (err) {
      logger.warn({ err, signature }, "Failed to parse event from transaction");
    }
  }

  return events;
}
