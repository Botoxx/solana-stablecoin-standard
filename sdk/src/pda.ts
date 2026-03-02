import { PublicKey } from "@solana/web3.js";
import type { RoleTypeValue } from "./types";

export const SSS_TOKEN_PROGRAM_ID = new PublicKey(
  "Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1"
);

export const TRANSFER_HOOK_PROGRAM_ID = new PublicKey(
  "7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj"
);

export const SSS_ORACLE_PROGRAM_ID = new PublicKey(
  "ADuTfewteACQzaBpxB2ShicPZVgzW21XMA64Y84pg92k"
);

const CONFIG_SEED = Buffer.from("config");
const MINTER_SEED = Buffer.from("minter");
const ROLE_SEED = Buffer.from("role");
const BLACKLIST_SEED = Buffer.from("blacklist");
const EXTRA_ACCOUNT_METAS_SEED = Buffer.from("extra-account-metas");
const ORACLE_FEED_SEED = Buffer.from("oracle-feed");

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
  roleType: RoleTypeValue,
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

export function getOracleFeedPda(
  config: PublicKey,
  pair: Buffer | Uint8Array | number[]
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ORACLE_FEED_SEED, config.toBuffer(), Buffer.from(pair)],
    SSS_ORACLE_PROGRAM_ID
  );
}
