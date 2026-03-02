import { PublicKey, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

export const Presets = {
  SSS_1: "sss-1",
  SSS_2: "sss-2",
} as const;

export type Preset = (typeof Presets)[keyof typeof Presets];

export const RoleType = {
  Minter: 0,
  Burner: 1,
  Pauser: 2,
  Blacklister: 3,
  Seizer: 4,
} as const;

export type RoleTypeValue = (typeof RoleType)[keyof typeof RoleType];

export const ROLE_TYPE_NAMES: Record<number, string> = {
  0: "minter",
  1: "burner",
  2: "pauser",
  3: "blacklister",
  4: "seizer",
};

export interface StablecoinExtensions {
  permanentDelegate?: boolean;
  transferHook?: boolean;
  defaultAccountFrozen?: boolean;
}

export interface CreateStablecoinParams {
  name: string;
  symbol: string;
  uri?: string;
  decimals?: number;
  authority: Keypair;
  treasury?: PublicKey;
  preset?: Preset;
  extensions?: StablecoinExtensions;
}

export interface MintParams {
  recipient: PublicKey;
  amount: BN;
  minter?: Keypair;
}

export interface BurnParams {
  amount: BN;
  burner?: Keypair;
  tokenAccount?: PublicKey;
}

export interface TransferParams {
  source: PublicKey;
  destination: PublicKey;
  owner: Keypair;
  amount: BN;
}

export interface BlacklistParams {
  address: PublicKey;
  reason: string;
}

export interface SeizeParams {
  sourceTokenAccount: PublicKey;
  treasuryTokenAccount: PublicKey;
  amount: BN;
}

export interface StablecoinState {
  authority: PublicKey;
  pendingAuthority: PublicKey | null;
  mint: PublicKey;
  treasury: PublicKey;
  decimals: number;
  paused: boolean;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  defaultAccountFrozen: boolean;
  transferHookProgram: PublicKey | null;
  totalMinted: BN;
  totalBurned: BN;
  bump: number;
}

export interface MinterState {
  config: PublicKey;
  minter: PublicKey;
  quotaTotal: BN;
  quotaRemaining: BN;
  bump: number;
}

export interface RoleState {
  config: PublicKey;
  roleType: RoleTypeValue;
  address: PublicKey;
  assignedBy: PublicKey;
  assignedAt: BN;
  bump: number;
}

export interface BlacklistState {
  config: PublicKey;
  address: PublicKey;
  reason: string;
  blacklistedAt: BN;
  blacklistedBy: PublicKey;
  active: boolean;
  bump: number;
}

// ==================== Oracle Types ====================

export const FeedType = {
  Switchboard: 0,
  Manual: 1,
} as const;

export type FeedTypeValue = (typeof FeedType)[keyof typeof FeedType];

export interface InitFeedParams {
  pair: string;
  feedAccount: PublicKey;
  feedType: FeedTypeValue;
  maxStaleness: number;
  minSamples: number;
  maxConfidence: BN;
  priceDecimals: number;
  switchboardProgram: PublicKey;
}

export interface FeedConfigUpdates {
  maxStaleness?: number;
  minSamples?: number;
  maxConfidence?: BN;
  priceDecimals?: number;
  enabled?: boolean;
  feedAccount?: PublicKey;
}

export interface OracleFeedConfig {
  config: PublicKey;
  authority: PublicKey;
  feedAccount: PublicKey;
  switchboardProgram: PublicKey;
  pair: string;
  maxStaleness: number;
  minSamples: number;
  maxConfidence: BN;
  priceDecimals: number;
  enabled: boolean;
  feedType: number;
  lastCachedPrice: BN;
  lastCachedSlot: BN;
  lastCachedTs: BN;
  bump: number;
}

export interface CachedPrice {
  price: BN;
  slot: BN;
  timestamp: BN;
  decimals: number;
}
