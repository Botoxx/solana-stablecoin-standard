import { PublicKey } from "@solana/web3.js";
import { TEST_PUBKEY, MOCK_MINT, MOCK_CONFIG_PDA } from "./test-wallet";

// --- Discriminators from IDL ---
const DISC = {
  StablecoinConfig: Buffer.from([127, 25, 244, 213, 1, 192, 101, 6]),
  RoleAssignment: Buffer.from([205, 130, 191, 231, 211, 225, 155, 246]),
  MinterConfig: Buffer.from([78, 211, 23, 6, 233, 19, 19, 236]),
  BlacklistEntry: Buffer.from([218, 179, 231, 40, 141, 25, 168, 189]),
};

// --- Helpers ---
function pubkeyBuf(pk: PublicKey): Buffer { return pk.toBuffer(); }
function u8(v: number): Buffer { return Buffer.from([v]); }
function bool(v: boolean): Buffer { return Buffer.from([v ? 1 : 0]); }
function optionPubkey(pk: PublicKey | null): Buffer {
  return pk ? Buffer.concat([u8(1), pubkeyBuf(pk)]) : u8(0);
}
function u64LE(n: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n));
  return buf;
}
function i64LE(n: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(Math.floor(Number(n))));
  return buf;
}
function borshString(s: string): Buffer {
  const strBuf = Buffer.from(s, "utf-8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(strBuf.length);
  return Buffer.concat([len, strBuf]);
}

// --- Encoders ---
export interface ConfigFields {
  authority?: PublicKey;
  pendingAuthority?: PublicKey | null;
  mint?: PublicKey;
  treasury?: PublicKey;
  decimals?: number;
  paused?: boolean;
  enablePermanentDelegate?: boolean;
  enableTransferHook?: boolean;
  defaultAccountFrozen?: boolean;
  transferHookProgram?: PublicKey | null;
  totalMinted?: number | bigint;
  totalBurned?: number | bigint;
  bump?: number;
}

export function encodeStablecoinConfig(f: ConfigFields = {}): Buffer {
  return Buffer.concat([
    DISC.StablecoinConfig,
    pubkeyBuf(f.authority ?? TEST_PUBKEY),
    optionPubkey(f.pendingAuthority ?? null),
    pubkeyBuf(f.mint ?? MOCK_MINT),
    pubkeyBuf(f.treasury ?? TEST_PUBKEY),
    u8(f.decimals ?? 6),
    bool(f.paused ?? false),
    bool(f.enablePermanentDelegate ?? false),
    bool(f.enableTransferHook ?? false),
    bool(f.defaultAccountFrozen ?? false),
    optionPubkey(f.transferHookProgram ?? null),
    u64LE(f.totalMinted ?? 0),
    u64LE(f.totalBurned ?? 0),
    u8(f.bump ?? 255),
    Buffer.alloc(64), // _reserved
  ]);
}

export interface RoleFields {
  config?: PublicKey;
  roleType?: number;
  address?: PublicKey;
  assignedBy?: PublicKey;
  assignedAt?: number | bigint;
  bump?: number;
}

export function encodeRoleAssignment(f: RoleFields = {}): Buffer {
  return Buffer.concat([
    DISC.RoleAssignment,
    pubkeyBuf(f.config ?? MOCK_CONFIG_PDA),
    u8(f.roleType ?? 0),
    pubkeyBuf(f.address ?? TEST_PUBKEY),
    pubkeyBuf(f.assignedBy ?? TEST_PUBKEY),
    i64LE(f.assignedAt ?? Date.now() / 1000),
    u8(f.bump ?? 254),
    Buffer.alloc(32), // _reserved
  ]);
}

export interface MinterFields {
  config?: PublicKey;
  minter?: PublicKey;
  quotaTotal?: number | bigint;
  quotaRemaining?: number | bigint;
  bump?: number;
}

export function encodeMinterConfig(f: MinterFields = {}): Buffer {
  return Buffer.concat([
    DISC.MinterConfig,
    pubkeyBuf(f.config ?? MOCK_CONFIG_PDA),
    pubkeyBuf(f.minter ?? TEST_PUBKEY),
    u64LE(f.quotaTotal ?? 1_000_000_000),
    u64LE(f.quotaRemaining ?? 1_000_000_000),
    u8(f.bump ?? 253),
    Buffer.alloc(32), // _reserved
  ]);
}

export interface BlacklistFields {
  config?: PublicKey;
  address?: PublicKey;
  reason?: string;
  blacklistedAt?: number | bigint;
  blacklistedBy?: PublicKey;
  active?: boolean;
  bump?: number;
}

export function encodeBlacklistEntry(f: BlacklistFields = {}): Buffer {
  return Buffer.concat([
    DISC.BlacklistEntry,
    pubkeyBuf(f.config ?? MOCK_CONFIG_PDA),
    pubkeyBuf(f.address ?? TEST_PUBKEY),
    borshString(f.reason ?? "OFAC sanctioned"),
    i64LE(f.blacklistedAt ?? Date.now() / 1000),
    pubkeyBuf(f.blacklistedBy ?? TEST_PUBKEY),
    bool(f.active ?? true),
    u8(f.bump ?? 252),
    Buffer.alloc(32), // _reserved
  ]);
}

// --- Pre-built configs ---
export const SSS1_CONFIG = encodeStablecoinConfig();
export const SSS2_CONFIG = encodeStablecoinConfig({
  enablePermanentDelegate: true,
  enableTransferHook: true,
  transferHookProgram: new PublicKey("7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj"),
});
