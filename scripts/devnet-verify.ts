/**
 * Devnet verification script — exercises the full SSS-2 flow.
 * Uses low-level helpers (same as integration tests) directly against devnet.
 *
 * Run: KEYPAIR_PATH=<path> npx ts-mocha -p ./tsconfig.json -t 300000 scripts/devnet-verify.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey, Connection, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import * as fs from "fs";
import { SssToken } from "../target/types/sss_token";
import { TransferHook } from "../target/types/transfer_hook";
import {
  createStablecoin,
  createTokenAccount,
  addMinter,
  mintTokens,
  assignRole,
  getTokenBalance,
  getConfigPda,
  getRolePda,
  getBlacklistPda,
  RoleType,
  SSS_TOKEN_PROGRAM_ID,
} from "../tests/helpers";

import sssTokenIdl from "../target/idl/sss_token.json";
import transferHookIdl from "../target/idl/transfer_hook.json";

const RPC = "https://api.devnet.solana.com";

function loadKeypair(): Keypair {
  const path = process.env.KEYPAIR_PATH || `${process.env.HOME}/.config/solana/id.json`;
  const raw = JSON.parse(fs.readFileSync(path, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

describe("Devnet Verification (SSS-2)", function () {
  this.timeout(300_000);

  const connection = new Connection(RPC, "confirmed");
  let authority: Keypair;
  let program: Program<SssToken>;
  let hookProgram: Program<TransferHook>;

  let mint: Keypair;
  let configPda: PublicKey;
  let authorityAta: PublicKey;

  const sigs: Record<string, string> = {};

  before(async () => {
    authority = loadKeypair();
    const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed" });
    anchor.setProvider(provider);

    program = new Program(sssTokenIdl as any, provider) as unknown as Program<SssToken>;
    hookProgram = new Program(transferHookIdl as any, provider) as unknown as Program<TransferHook>;

    const balance = await connection.getBalance(authority.publicKey);
    console.log(`  Authority: ${authority.publicKey.toBase58()}`);
    console.log(`  Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    if (balance < 0.3 * LAMPORTS_PER_SOL) {
      throw new Error("Insufficient balance — need at least 0.3 SOL");
    }
  });

  it("initializes SSS-2 stablecoin", async () => {
    const result = await createStablecoin(program, hookProgram, authority, {
      name: "SSS Demo USD",
      symbol: "SDUSD",
      uri: "https://sss.example.com/metadata.json",
      decimals: 6,
      enablePermanentDelegate: true,
      enableTransferHook: true,
      defaultAccountFrozen: false,
      treasury: authority.publicKey,
    });
    mint = result.mint;
    configPda = result.configPda;
    console.log(`    Mint: ${mint.publicKey.toBase58()}`);
    console.log(`    Config: ${configPda.toBase58()}`);
  });

  it("adds minter with 10,000 token quota", async () => {
    await addMinter(program, authority, configPda, authority.publicKey, new anchor.BN(10_000_000_000));
    console.log(`    Minter added: ${authority.publicKey.toBase58()}`);
  });

  it("creates token account and mints 1000 SDUSD", async () => {
    authorityAta = await createTokenAccount(connection, authority, mint.publicKey, authority.publicKey);
    const sig = await mintTokens(program, authority, configPda, mint.publicKey, authorityAta, new anchor.BN(1_000_000_000));
    sigs.mint = sig;
    console.log(`    Mint TX: ${sig}`);

    const bal = await getTokenBalance(connection, authorityAta);
    expect(bal).to.equal(BigInt(1_000_000_000));
    console.log(`    Balance: ${bal} (1000 SDUSD)`);
  });

  it("pauses and unpauses", async () => {
    await assignRole(program, authority, configPda, authority.publicKey, RoleType.Pauser);
    const [pauserPda] = getRolePda(configPda, RoleType.Pauser, authority.publicKey);

    await program.methods.pause()
      .accounts({ pauser: authority.publicKey, config: configPda, roleAssignment: pauserPda } as any)
      .signers([authority]).rpc();
    sigs.pause = "confirmed";

    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.paused).to.be.true;
    console.log(`    Paused: true`);

    await program.methods.unpause()
      .accounts({ pauser: authority.publicKey, config: configPda, roleAssignment: pauserPda } as any)
      .signers([authority]).rpc();
    sigs.unpause = "confirmed";

    const config2 = await program.account.stablecoinConfig.fetch(configPda);
    expect(config2.paused).to.be.false;
    console.log(`    Paused: false (unpaused)`);
  });

  it("blacklists and unblacklists address", async () => {
    await assignRole(program, authority, configPda, authority.publicKey, RoleType.Blacklister);

    const target = Keypair.generate().publicKey;
    const [blacklistPda] = getBlacklistPda(configPda, target);
    const [rolePda] = getRolePda(configPda, RoleType.Blacklister, authority.publicKey);

    const blSig = await program.methods.addToBlacklist(target, "Demo sanctions test")
      .accounts({
        blacklister: authority.publicKey,
        config: configPda,
        roleAssignment: rolePda,
        blacklistEntry: blacklistPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([authority]).rpc();
    sigs.blacklist = blSig;
    console.log(`    Blacklist TX: ${blSig}`);

    const entry = await program.account.blacklistEntry.fetch(blacklistPda);
    expect(entry.active).to.be.true;

    const unblSig = await program.methods.removeFromBlacklist(target)
      .accounts({
        blacklister: authority.publicKey,
        config: configPda,
        roleAssignment: rolePda,
        blacklistEntry: blacklistPda,
      } as any)
      .signers([authority]).rpc();
    sigs.unblacklist = unblSig;
    console.log(`    Unblacklist TX: ${unblSig}`);

    const entry2 = await program.account.blacklistEntry.fetch(blacklistPda);
    expect(entry2.active).to.be.false;
  });

  after(() => {
    console.log("\n  === DEVNET VERIFICATION COMPLETE ===");
    console.log("  Programs:");
    console.log(`    sss_token:     ${sssTokenIdl.address}`);
    console.log(`    transfer_hook: ${transferHookIdl.address}`);
    if (mint) {
      console.log(`  Mint: ${mint.publicKey.toBase58()}`);
      console.log(`  Config: ${configPda.toBase58()}`);
    }
    console.log("  Key Transactions:");
    for (const [name, sig] of Object.entries(sigs)) {
      if (sig === "confirmed") {
        console.log(`    ${name.padEnd(20)} OK`);
      } else {
        console.log(`    ${name.padEnd(20)} https://explorer.solana.com/tx/${sig}?cluster=devnet`);
      }
    }
  });
});
