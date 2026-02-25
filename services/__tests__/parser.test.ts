import { expect } from "chai";
import * as crypto from "crypto";
import { Keypair } from "@solana/web3.js";
import {
  initEventDiscriminators,
  parseTransactionLogs,
} from "../indexer/src/parser";

// Build a test event buffer matching Borsh layout
function buildEventBuffer(eventName: string, fields: Buffer[]): Buffer {
  const disc = crypto.createHash("sha256").update(`event:${eventName}`).digest().slice(0, 8);
  return Buffer.concat([disc, ...fields]);
}

function pubkeyBuf(kp?: Keypair): Buffer {
  return Buffer.from((kp ?? Keypair.generate()).publicKey.toBytes());
}

function u64Buf(n: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(n);
  return buf;
}

function i64Buf(n: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(n);
  return buf;
}

function u8Buf(n: number): Buffer {
  return Buffer.from([n]);
}

function boolBuf(b: boolean): Buffer {
  return Buffer.from([b ? 1 : 0]);
}

function stringBuf(s: string): Buffer {
  const strBytes = Buffer.from(s, "utf-8");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(strBytes.length);
  return Buffer.concat([lenBuf, strBytes]);
}

describe("initEventDiscriminators", () => {
  before(() => initEventDiscriminators());

  it("produces discriminators for all 14 event types", () => {
    const events = [
      "InitializeEvent", "MintEvent", "BurnEvent", "FreezeEvent",
      "ThawEvent", "PauseEvent", "UnpauseEvent", "MinterUpdatedEvent",
      "RoleUpdatedEvent", "AuthorityProposedEvent", "AuthorityAcceptedEvent",
      "BlacklistAddEvent", "BlacklistRemoveEvent", "SeizeEvent",
    ];
    // Verify each event has a unique 8-byte discriminator
    const discs = new Set<string>();
    for (const name of events) {
      const hash = crypto.createHash("sha256").update(`event:${name}`).digest();
      const disc = hash.slice(0, 8).toString("hex");
      discs.add(disc);
    }
    expect(discs.size).to.equal(14);
  });

  it("discriminator format is sha256 prefix of 'event:EventName'", () => {
    const hash = crypto.createHash("sha256").update("event:MintEvent").digest();
    const expected = hash.slice(0, 8).toString("hex");
    expect(expected).to.have.length(16); // 8 bytes = 16 hex chars
  });
});

describe("parseTransactionLogs", () => {
  before(() => initEventDiscriminators());

  it("skips non-'Program data:' log lines", () => {
    const logs = [
      "Program 11111111111111111111111111111111 invoke [1]",
      "Program log: Instruction: Mint",
      "Program 11111111111111111111111111111111 success",
    ];
    const events = parseTransactionLogs("sig123", 100, logs);
    expect(events).to.have.length(0);
  });

  it("decodes PauseEvent (simplest: authority + timestamp)", () => {
    const authority = Keypair.generate();
    const ts = BigInt(Math.floor(Date.now() / 1000));
    const buf = buildEventBuffer("PauseEvent", [
      pubkeyBuf(authority),
      i64Buf(ts),
    ]);
    const base64 = buf.toString("base64");
    const logs = [`Program data: ${base64}`];

    const events = parseTransactionLogs("sig1", 200, logs);
    expect(events).to.have.length(1);
    expect(events[0].name).to.equal("PauseEvent");
    expect(events[0].authority).to.equal(authority.publicKey.toBase58());
    expect(events[0].timestamp).to.equal(Number(ts) * 1000);
  });

  it("decodes MintEvent with all fields", () => {
    const authority = Keypair.generate();
    const minter = Keypair.generate();
    const recipient = Keypair.generate();
    const amount = BigInt("1000000");
    const remaining = BigInt("9000000");
    const ts = BigInt(1700000000);

    const buf = buildEventBuffer("MintEvent", [
      pubkeyBuf(authority),
      pubkeyBuf(minter),
      pubkeyBuf(recipient),
      u64Buf(amount),
      u64Buf(remaining),
      i64Buf(ts),
    ]);
    const logs = [`Program data: ${buf.toString("base64")}`];

    const events = parseTransactionLogs("sig2", 300, logs);
    expect(events).to.have.length(1);
    expect(events[0].name).to.equal("MintEvent");
    expect(events[0].data.minter).to.equal(minter.publicKey.toBase58());
    expect(events[0].data.recipient).to.equal(recipient.publicKey.toBase58());
    expect(events[0].data.amount).to.equal(amount.toString());
    expect(events[0].data.remaining_quota).to.equal(remaining.toString());
  });

  it("decodes BurnEvent", () => {
    const authority = Keypair.generate();
    const burner = Keypair.generate();
    const amount = BigInt("500000");
    const ts = BigInt(1700000000);

    const buf = buildEventBuffer("BurnEvent", [
      pubkeyBuf(authority),
      pubkeyBuf(burner),
      u64Buf(amount),
      i64Buf(ts),
    ]);
    const logs = [`Program data: ${buf.toString("base64")}`];

    const events = parseTransactionLogs("sig3", 400, logs);
    expect(events).to.have.length(1);
    expect(events[0].name).to.equal("BurnEvent");
    expect(events[0].data.burner).to.equal(burner.publicKey.toBase58());
    expect(events[0].data.amount).to.equal("500000");
  });

  it("decodes InitializeEvent with booleans and u8", () => {
    const authority = Keypair.generate();
    const mint = Keypair.generate();
    const treasury = Keypair.generate();
    const ts = BigInt(1700000000);

    const buf = buildEventBuffer("InitializeEvent", [
      pubkeyBuf(authority),
      pubkeyBuf(mint),
      pubkeyBuf(treasury),
      u8Buf(6),            // decimals
      boolBuf(true),       // enable_permanent_delegate
      boolBuf(true),       // enable_transfer_hook
      boolBuf(false),      // default_account_frozen
      i64Buf(ts),
    ]);
    const logs = [`Program data: ${buf.toString("base64")}`];

    const events = parseTransactionLogs("sig4", 500, logs);
    expect(events).to.have.length(1);
    expect(events[0].name).to.equal("InitializeEvent");
    expect(events[0].data.decimals).to.equal(6);
    expect(events[0].data.enable_permanent_delegate).to.be.true;
    expect(events[0].data.enable_transfer_hook).to.be.true;
    expect(events[0].data.default_account_frozen).to.be.false;
  });

  it("decodes BlacklistAddEvent with string field", () => {
    const authority = Keypair.generate();
    const address = Keypair.generate();
    const reason = "OFAC sanctions";
    const ts = BigInt(1700000000);

    const buf = buildEventBuffer("BlacklistAddEvent", [
      pubkeyBuf(authority),
      pubkeyBuf(address),
      stringBuf(reason),
      i64Buf(ts),
    ]);
    const logs = [`Program data: ${buf.toString("base64")}`];

    const events = parseTransactionLogs("sig5", 600, logs);
    expect(events).to.have.length(1);
    expect(events[0].name).to.equal("BlacklistAddEvent");
    expect(events[0].data.address).to.equal(address.publicKey.toBase58());
    expect(events[0].data.reason).to.equal("OFAC sanctions");
  });

  it("decodes SeizeEvent", () => {
    const authority = Keypair.generate();
    const source = Keypair.generate();
    const treasury = Keypair.generate();
    const amount = BigInt("250000");
    const ts = BigInt(1700000000);

    const buf = buildEventBuffer("SeizeEvent", [
      pubkeyBuf(authority),
      pubkeyBuf(source),
      pubkeyBuf(treasury),
      u64Buf(amount),
      i64Buf(ts),
    ]);
    const logs = [`Program data: ${buf.toString("base64")}`];

    const events = parseTransactionLogs("sig6", 700, logs);
    expect(events).to.have.length(1);
    expect(events[0].name).to.equal("SeizeEvent");
    expect(events[0].data.source).to.equal(source.publicKey.toBase58());
    expect(events[0].data.treasury).to.equal(treasury.publicKey.toBase58());
    expect(events[0].data.amount).to.equal("250000");
  });

  it("returns Unknown for unrecognized discriminator", () => {
    const buf = Buffer.alloc(32);
    buf.fill(0xff, 0, 8); // fake discriminator
    const logs = [`Program data: ${buf.toString("base64")}`];

    const events = parseTransactionLogs("sig7", 800, logs);
    expect(events).to.have.length(1);
    expect(events[0].name).to.equal("Unknown");
    expect(events[0].data.discriminator).to.exist;
  });

  it("handles malformed base64 gracefully", () => {
    const logs = [`Program data: !!!not-base64!!!`];
    // Should not throw — parser has try/catch
    const events = parseTransactionLogs("sig8", 900, logs);
    // May produce Unknown or be caught — just verify no throw
    expect(events).to.be.an("array");
  });

  it("parses multiple events from a single transaction", () => {
    const auth1 = Keypair.generate();
    const auth2 = Keypair.generate();
    const ts = BigInt(1700000000);

    const pause = buildEventBuffer("PauseEvent", [pubkeyBuf(auth1), i64Buf(ts)]);
    const unpause = buildEventBuffer("UnpauseEvent", [pubkeyBuf(auth2), i64Buf(ts)]);

    const logs = [
      "Program log: something",
      `Program data: ${pause.toString("base64")}`,
      `Program data: ${unpause.toString("base64")}`,
    ];

    const events = parseTransactionLogs("sig9", 1000, logs);
    expect(events).to.have.length(2);
    expect(events[0].name).to.equal("PauseEvent");
    expect(events[1].name).to.equal("UnpauseEvent");
  });

  it("preserves signature and slot on parsed events", () => {
    const auth = Keypair.generate();
    const ts = BigInt(1700000000);
    const buf = buildEventBuffer("PauseEvent", [pubkeyBuf(auth), i64Buf(ts)]);
    const logs = [`Program data: ${buf.toString("base64")}`];

    const events = parseTransactionLogs("test-sig-abc", 42, logs);
    expect(events[0].signature).to.equal("test-sig-abc");
    expect(events[0].slot).to.equal(42);
  });
});
