import { PublicKey } from "@solana/web3.js";

export const SSS_TOKEN_PROGRAM_ID = new PublicKey("Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1");
export const TRANSFER_HOOK_PROGRAM_ID = new PublicKey("7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj");

export const CONFIG_SEED = Buffer.from("config");
export const MINTER_SEED = Buffer.from("minter");
export const ROLE_SEED = Buffer.from("role");
export const BLACKLIST_SEED = Buffer.from("blacklist");
export const EXTRA_ACCOUNT_METAS_SEED = Buffer.from("extra-account-metas");

export function getConfigPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CONFIG_SEED, mint.toBuffer()], SSS_TOKEN_PROGRAM_ID);
}

export function getMinterPda(config: PublicKey, minter: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MINTER_SEED, config.toBuffer(), minter.toBuffer()],
    SSS_TOKEN_PROGRAM_ID,
  );
}

export function getRolePda(config: PublicKey, roleType: number, address: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ROLE_SEED, config.toBuffer(), Buffer.from([roleType]), address.toBuffer()],
    SSS_TOKEN_PROGRAM_ID,
  );
}

export function getBlacklistPda(config: PublicKey, address: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BLACKLIST_SEED, config.toBuffer(), address.toBuffer()],
    SSS_TOKEN_PROGRAM_ID,
  );
}

export function getExtraAccountMetasPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [EXTRA_ACCOUNT_METAS_SEED, mint.toBuffer()],
    TRANSFER_HOOK_PROGRAM_ID,
  );
}

export const RoleType = { Minter: 0, Burner: 1, Pauser: 2, Blacklister: 3, Seizer: 4 } as const;
export type RoleTypeValue = (typeof RoleType)[keyof typeof RoleType];

export const ROLE_TYPE_NAMES: Record<number, string> = {
  0: "minter", 1: "burner", 2: "pauser", 3: "blacklister", 4: "seizer",
};

export const Presets = { SSS_1: "sss-1", SSS_2: "sss-2" } as const;
export type Preset = (typeof Presets)[keyof typeof Presets];

export interface StablecoinExtensions {
  permanentDelegate: boolean;
  transferHook: boolean;
  defaultAccountFrozen: boolean;
}

export const PRESET_EXTENSIONS: Record<Preset, StablecoinExtensions> = {
  [Presets.SSS_1]: { permanentDelegate: false, transferHook: false, defaultAccountFrozen: false },
  [Presets.SSS_2]: { permanentDelegate: true, transferHook: true, defaultAccountFrozen: false },
};

export function resolveExtensions(
  preset?: Preset,
  overrides?: Partial<StablecoinExtensions>,
): StablecoinExtensions {
  const base = preset ? PRESET_EXTENSIONS[preset] : PRESET_EXTENSIONS[Presets.SSS_1];
  return {
    permanentDelegate: overrides?.permanentDelegate ?? base.permanentDelegate,
    transferHook: overrides?.transferHook ?? base.transferHook,
    defaultAccountFrozen: overrides?.defaultAccountFrozen ?? base.defaultAccountFrozen,
  };
}

export const ERROR_MESSAGES: Record<number, string> = {
  6000: "Unauthorized: you don't have the required role",
  6001: "System is paused",
  6002: "System is not paused",
  6003: "Sender is blacklisted",
  6004: "Recipient is blacklisted",
  6005: "Account must be frozen before seizure",
  6006: "Invalid treasury address",
  6007: "Minter quota exceeded",
  6008: "Blacklist reason is required",
  6009: "Compliance features not enabled",
  6010: "Address is already blacklisted",
  6011: "Address is not blacklisted",
  6012: "Invalid role type",
  6013: "Authority mismatch",
  6014: "Pending authority mismatch",
  6015: "No pending authority transfer",
  6016: "Minter already configured",
  6017: "Minter not found",
  6018: "Amount must be greater than zero",
  6019: "String length exceeds maximum",
  6020: "Arithmetic overflow",
  6021: "Mint does not match config",
  6022: "Blacklist reason too long",
  6023: "Role already assigned",
};
