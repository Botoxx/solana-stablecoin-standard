import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Connection,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createTransferCheckedWithTransferHookInstruction,
} from "@solana/spl-token";
import { SssToken } from "../../target/types/sss_token";
import { TransferHook } from "../../target/types/transfer_hook";
import {
  getConfigPda,
  getMinterPda,
  getRolePda,
  getBlacklistPda,
  getExtraAccountMetasPda,
  getOracleFeedPda,
  RoleType,
  SSS_TOKEN_PROGRAM_ID,
  TRANSFER_HOOK_PROGRAM_ID,
  SSS_ORACLE_PROGRAM_ID,
} from "./pda";

export {
  getConfigPda,
  getMinterPda,
  getRolePda,
  getBlacklistPda,
  getExtraAccountMetasPda,
  getOracleFeedPda,
  RoleType,
  SSS_TOKEN_PROGRAM_ID,
  TRANSFER_HOOK_PROGRAM_ID,
  SSS_ORACLE_PROGRAM_ID,
};

export async function airdropSol(
  connection: Connection,
  address: PublicKey,
  amount: number = 10
): Promise<void> {
  const sig = await connection.requestAirdrop(
    address,
    amount * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(sig, "confirmed");
}

export async function createTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(
    mint,
    owner,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const tx = new anchor.web3.Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      ata,
      owner,
      mint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  await anchor.web3.sendAndConfirmTransaction(connection, tx, [payer]);
  return ata;
}

export interface CreateStablecoinResult {
  mint: Keypair;
  configPda: PublicKey;
  configBump: number;
}

export async function createStablecoin(
  program: Program<SssToken>,
  hookProgram: Program<TransferHook> | null,
  authority: Keypair,
  opts: {
    name?: string;
    symbol?: string;
    uri?: string;
    decimals?: number;
    enablePermanentDelegate?: boolean;
    enableTransferHook?: boolean;
    defaultAccountFrozen?: boolean;
    treasury?: PublicKey;
  } = {}
): Promise<CreateStablecoinResult> {
  const mint = Keypair.generate();
  const [configPda, configBump] = getConfigPda(mint.publicKey);
  const treasury = opts.treasury || authority.publicKey;

  const enableTransferHook = opts.enableTransferHook ?? false;
  const transferHookProgramId = enableTransferHook
    ? TRANSFER_HOOK_PROGRAM_ID
    : null;

  await program.methods
    .initialize({
      name: opts.name || "Test USD",
      symbol: opts.symbol || "TUSD",
      uri: opts.uri || "https://example.com/tusd.json",
      decimals: opts.decimals ?? 6,
      enablePermanentDelegate: opts.enablePermanentDelegate ?? false,
      enableTransferHook,
      defaultAccountFrozen: opts.defaultAccountFrozen ?? false,
      transferHookProgramId,
      treasury,
    })
    .accounts({
      authority: authority.publicKey,
      config: configPda,
      mint: mint.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .signers([authority, mint])
    .rpc();

  // If transfer hook is enabled, initialize the extra account meta list
  if (enableTransferHook && hookProgram) {
    const [extraAccountMetasPda] = getExtraAccountMetasPda(mint.publicKey);

    await hookProgram.methods
      .initializeExtraAccountMetaList(SSS_TOKEN_PROGRAM_ID)
      .accounts({
        payer: authority.publicKey,
        extraAccountMetaList: extraAccountMetasPda,
        mint: mint.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();
  }

  return { mint, configPda, configBump };
}

const ROLE_TYPE_NAMES: Record<number, string> = {
  0: "minter",
  1: "burner",
  2: "pauser",
  3: "blacklister",
  4: "seizer",
};

export async function assignRole(
  program: Program<SssToken>,
  authority: Keypair,
  config: PublicKey,
  address: PublicKey,
  role: number
): Promise<PublicKey> {
  const [rolePda] = getRolePda(config, role, address);

  await program.methods
    .updateRoles(address, { [ROLE_TYPE_NAMES[role]]: {} } as any, {
      assign: {},
    })
    .accounts({
      authority: authority.publicKey,
      config,
      roleAssignment: rolePda,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  return rolePda;
}

export async function addMinter(
  program: Program<SssToken>,
  authority: Keypair,
  config: PublicKey,
  minterAddress: PublicKey,
  quota: anchor.BN
): Promise<PublicKey> {
  // First assign the minter role
  const rolePda = await assignRole(
    program,
    authority,
    config,
    minterAddress,
    RoleType.Minter
  );

  // Then create minter config
  const [minterPda] = getMinterPda(config, minterAddress);
  await program.methods
    .updateMinter(minterAddress, { add: { quota } })
    .accounts({
      authority: authority.publicKey,
      config,
      minterConfig: minterPda,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  return minterPda;
}

export async function mintTokens(
  program: Program<SssToken>,
  minter: Keypair,
  config: PublicKey,
  mint: PublicKey,
  recipientTokenAccount: PublicKey,
  amount: anchor.BN
): Promise<string> {
  const [rolePda] = getRolePda(config, RoleType.Minter, minter.publicKey);
  const [minterPda] = getMinterPda(config, minter.publicKey);

  return program.methods
    .mint(amount)
    .accounts({
      minter: minter.publicKey,
      config,
      roleAssignment: rolePda,
      minterConfig: minterPda,
      mint,
      recipientTokenAccount,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([minter])
    .rpc();
}

export async function transferWithHook(
  connection: Connection,
  payer: Keypair,
  source: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  owner: Keypair,
  amount: number,
  decimals: number
): Promise<string> {
  const ix = await createTransferCheckedWithTransferHookInstruction(
    connection,
    source,
    mint,
    destination,
    owner.publicKey,
    BigInt(amount),
    decimals,
    [],
    "confirmed",
    TOKEN_2022_PROGRAM_ID
  );

  const tx = new anchor.web3.Transaction().add(ix);
  return anchor.web3.sendAndConfirmTransaction(connection, tx, [payer, owner]);
}

export async function assertError(
  fn: () => Promise<any>,
  errorCode?: string | number
): Promise<void> {
  try {
    await fn();
    throw new Error("Expected error but transaction succeeded");
  } catch (err: any) {
    if (err.message === "Expected error but transaction succeeded") {
      throw err;
    }
    if (errorCode) {
      const errStr = err.toString();
      const found =
        errStr.includes(errorCode.toString()) ||
        errStr.includes(`Error Code: ${errorCode}`) ||
        (typeof errorCode === "number" && errStr.includes(`0x${errorCode.toString(16)}`));
      if (!found) {
        throw new Error(
          `Expected error code "${errorCode}" but got: ${errStr}`
        );
      }
    }
  }
}

export function getTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<bigint> {
  return connection
    .getTokenAccountBalance(tokenAccount)
    .then((b) => BigInt(b.value.amount));
}
