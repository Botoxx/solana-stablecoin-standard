import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

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

export interface CreateStablecoinParams {
  name: string;
  symbol: string;
  uri: string;
  decimals?: number;
  enablePermanentDelegate?: boolean;
  enableTransferHook?: boolean;
  defaultAccountFrozen?: boolean;
  treasury?: PublicKey;
}

export interface MintParams {
  recipient: PublicKey;
  amount: BN;
}

export interface BurnParams {
  tokenAccount: PublicKey;
  amount: BN;
}

export interface TransferParams {
  source: PublicKey;
  destination: PublicKey;
  owner: PublicKey;
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
  roleType: number;
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

export type Preset = "sss-1" | "sss-2";
