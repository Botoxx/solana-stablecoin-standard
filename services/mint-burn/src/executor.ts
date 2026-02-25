import { Pool } from "pg";
import { Logger } from "pino";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, BN, Wallet, Idl } from "@coral-xyz/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { logAudit } from "../../shared/audit";

const CONFIG_SEED = Buffer.from("config");
const MINTER_SEED = Buffer.from("minter");
const ROLE_SEED = Buffer.from("role");

const ROLE_MINTER = 0;
const ROLE_BURNER = 1;

function loadAuthorityKeypair(): Keypair {
  const raw = process.env.AUTHORITY_KEYPAIR;
  if (!raw) throw new Error("AUTHORITY_KEYPAIR env var required (JSON byte array)");
  let parsed: number[];
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AUTHORITY_KEYPAIR contains invalid JSON (value not logged for security)");
  }
  if (!Array.isArray(parsed) || parsed.length !== 64) {
    throw new Error(`AUTHORITY_KEYPAIR must be a 64-byte array, got ${parsed?.length ?? 0} elements`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(parsed));
}

function deriveConfigPda(mint: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CONFIG_SEED, mint.toBuffer()], programId);
}

function deriveMinterPda(config: PublicKey, minter: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MINTER_SEED, config.toBuffer(), minter.toBuffer()],
    programId
  );
}

function deriveRolePda(config: PublicKey, roleType: number, address: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ROLE_SEED, config.toBuffer(), Buffer.from([roleType]), address.toBuffer()],
    programId
  );
}

export async function processPendingRequests(
  pool: Pool,
  logger: Logger,
  program: Program,
  authority: Keypair
): Promise<void> {
  const result = await pool.query(
    `UPDATE mint_burn_requests
     SET status = 'processing', updated_at = NOW()
     WHERE id = (
       SELECT id FROM mint_burn_requests
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`
  );

  if (result.rows.length === 0) return;

  const request = result.rows[0];
  logger.info({ id: request.id, action: request.action }, "Processing request");

  let onChainSuccess = false;
  let signature: string | undefined;

  try {
    const configPda = new PublicKey(request.config_pda);
    const config = await (program.account as any)["stablecoinConfig"].fetch(configPda);
    const mint = config.mint as PublicKey;

    if (request.action === "mint") {
      const recipient = new PublicKey(request.recipient);
      const recipientAta = getAssociatedTokenAddressSync(
        mint, recipient, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const [minterPda] = deriveMinterPda(configPda, authority.publicKey, program.programId);
      const [rolePda] = deriveRolePda(configPda, ROLE_MINTER, authority.publicKey, program.programId);

      signature = await program.methods
        .mint(new BN(request.amount))
        .accounts({
          minter: authority.publicKey,
          roleAssignment: rolePda,
          minterConfig: minterPda,
          mint,
          recipientTokenAccount: recipientAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        } as any)
        .signers([authority])
        .rpc();
    } else {
      const tokenAccount = new PublicKey(request.token_account);
      const [rolePda] = deriveRolePda(configPda, ROLE_BURNER, authority.publicKey, program.programId);

      signature = await program.methods
        .burn(new BN(request.amount))
        .accounts({
          burner: authority.publicKey,
          roleAssignment: rolePda,
          mint,
          burnerTokenAccount: tokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        } as any)
        .signers([authority])
        .rpc();
    }

    onChainSuccess = true;

    await pool.query(
      `UPDATE mint_burn_requests
       SET status = 'completed', signature = $1, updated_at = NOW()
       WHERE id = $2`,
      [signature, request.id]
    );

    await logAudit(pool, {
      action: request.action,
      operator: authority.publicKey.toBase58(),
      target: request.recipient || request.token_account,
      details: { amount: request.amount, requestId: request.id },
      signature,
    });

    logger.info({ id: request.id, signature }, "Request completed");
  } catch (err: any) {
    if (onChainSuccess) {
      // On-chain tx succeeded but DB update failed — do NOT mark as failed
      logger.error(
        { id: request.id, signature, err },
        "CRITICAL: On-chain tx succeeded but DB update failed. Manual reconciliation required."
      );
      return;
    }
    await pool.query(
      `UPDATE mint_burn_requests
       SET status = 'failed', error = $1, updated_at = NOW()
       WHERE id = $2`,
      [err.message, request.id]
    ).catch((dbErr) => {
      logger.error({ id: request.id, dbErr }, "Failed to update request status");
    });
    logger.error({ id: request.id, err }, "Request failed");
  }
}

export function startExecutor(
  pool: Pool,
  logger: Logger,
  rpcUrl: string,
  programIdStr: string,
  intervalMs = 5000
) {
  const authority = loadAuthorityKeypair();
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed" });

  // Load IDL at runtime — in production, bake this into the Docker image
  const idl = require("../../shared/idl/sss_token.json");
  const programId = new PublicKey(programIdStr);
  const program = new Program(idl, provider);

  logger.info(
    { authority: authority.publicKey.toBase58(), programId: programIdStr },
    "Executor initialized"
  );

  const timer = setInterval(async () => {
    try {
      await processPendingRequests(pool, logger, program, authority);
    } catch (err) {
      logger.error({ err }, "Executor error");
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
