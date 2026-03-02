import { PublicKey } from "@solana/web3.js";

const SSS_TOKEN_PROGRAM_ID = new PublicKey(
  "Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1"
);
const TRANSFER_HOOK_PROGRAM_ID = new PublicKey(
  "7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj"
);

export { SSS_TOKEN_PROGRAM_ID, TRANSFER_HOOK_PROGRAM_ID };

export function getConfigPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config"), mint.toBuffer()],
    SSS_TOKEN_PROGRAM_ID
  );
}

export function getMinterPda(
  config: PublicKey,
  minter: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("minter"), config.toBuffer(), minter.toBuffer()],
    SSS_TOKEN_PROGRAM_ID
  );
}

export function getRolePda(
  config: PublicKey,
  roleType: number,
  address: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("role"),
      config.toBuffer(),
      Buffer.from([roleType]),
      address.toBuffer(),
    ],
    SSS_TOKEN_PROGRAM_ID
  );
}

export function getBlacklistPda(
  config: PublicKey,
  address: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("blacklist"), config.toBuffer(), address.toBuffer()],
    SSS_TOKEN_PROGRAM_ID
  );
}

export function getExtraAccountMetasPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), mint.toBuffer()],
    TRANSFER_HOOK_PROGRAM_ID
  );
}

export const RoleType = {
  Minter: 0,
  Burner: 1,
  Pauser: 2,
  Blacklister: 3,
  Seizer: 4,
} as const;

export const SSS_ORACLE_PROGRAM_ID = new PublicKey(
  "ADuTfewteACQzaBpxB2ShicPZVgzW21XMA64Y84pg92k"
);

export function getOracleFeedPda(
  config: PublicKey,
  pair: number[] | Uint8Array | Buffer
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("oracle-feed"), config.toBuffer(), Buffer.from(pair)],
    SSS_ORACLE_PROGRAM_ID
  );
}
