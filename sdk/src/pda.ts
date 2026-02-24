import { PublicKey } from "@solana/web3.js";

export const SSS_TOKEN_PROGRAM_ID = new PublicKey(
  "Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1"
);

export const TRANSFER_HOOK_PROGRAM_ID = new PublicKey(
  "7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj"
);

const CONFIG_SEED = Buffer.from("config");
const MINTER_SEED = Buffer.from("minter");
const ROLE_SEED = Buffer.from("role");
const BLACKLIST_SEED = Buffer.from("blacklist");
const EXTRA_ACCOUNT_METAS_SEED = Buffer.from("extra-account-metas");

export function getConfigPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CONFIG_SEED, mint.toBuffer()],
    SSS_TOKEN_PROGRAM_ID
  );
}

export function getMinterPda(
  config: PublicKey,
  minter: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MINTER_SEED, config.toBuffer(), minter.toBuffer()],
    SSS_TOKEN_PROGRAM_ID
  );
}

export function getRolePda(
  config: PublicKey,
  roleType: number,
  address: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ROLE_SEED, config.toBuffer(), Buffer.from([roleType]), address.toBuffer()],
    SSS_TOKEN_PROGRAM_ID
  );
}

export function getBlacklistPda(
  config: PublicKey,
  address: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BLACKLIST_SEED, config.toBuffer(), address.toBuffer()],
    SSS_TOKEN_PROGRAM_ID
  );
}

export function getExtraAccountMetasPda(
  mint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [EXTRA_ACCOUNT_METAS_SEED, mint.toBuffer()],
    TRANSFER_HOOK_PROGRAM_ID
  );
}
