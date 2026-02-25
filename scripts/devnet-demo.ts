import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  Connection,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const SSS_TOKEN_PROGRAM_ID = new PublicKey("Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1");
const TRANSFER_HOOK_PROGRAM_ID = new PublicKey("7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj");

function getConfigPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config"), mint.toBuffer()],
    SSS_TOKEN_PROGRAM_ID
  );
}
function getMinterPda(config: PublicKey, minter: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("minter"), config.toBuffer(), minter.toBuffer()],
    SSS_TOKEN_PROGRAM_ID
  );
}
function getRolePda(config: PublicKey, roleType: number, address: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("role"), config.toBuffer(), Buffer.from([roleType]), address.toBuffer()],
    SSS_TOKEN_PROGRAM_ID
  );
}
function getExtraAccountMetasPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), mint.toBuffer()],
    TRANSFER_HOOK_PROGRAM_ID
  );
}

async function main() {
  const keypairPath = process.env.ANCHOR_WALLET || "/Users/b0t1/repo/superteam-brazil-lms/wallets/signer.json";
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

  const sssIdl = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../target/idl/sss_token.json"), "utf8")
  );
  const hookIdl = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../target/idl/transfer_hook.json"), "utf8")
  );

  const program = new Program(sssIdl, provider);
  const hookProgram = new Program(hookIdl, provider);

  const results: Record<string, string> = {};

  console.log("=== SSS Devnet Demo ===");
  console.log(`Authority: ${authority.publicKey.toBase58()}`);

  // 1. Initialize SSS-2 stablecoin
  const mint = Keypair.generate();
  const [configPda] = getConfigPda(mint.publicKey);
  console.log(`\nMint: ${mint.publicKey.toBase58()}`);
  console.log(`Config PDA: ${configPda.toBase58()}`);

  const initSig = await program.methods
    .initialize({
      name: "SSS Demo USD",
      symbol: "SDUSD",
      uri: "https://raw.githubusercontent.com/solanabr/solana-stablecoin-standard/main/assets/metadata.json",
      decimals: 6,
      enablePermanentDelegate: true,
      enableTransferHook: true,
      defaultAccountFrozen: false,
      transferHookProgramId: TRANSFER_HOOK_PROGRAM_ID,
      treasury: authority.publicKey,
    })
    .accounts({
      authority: authority.publicKey,
      config: configPda,
      mint: mint.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    } as any)
    .signers([authority, mint])
    .rpc();

  results["initialize"] = initSig;
  console.log(`\n1. Initialize: ${initSig}`);

  // 2. Initialize extra account metas for transfer hook
  const [extraAccountMetasPda] = getExtraAccountMetasPda(mint.publicKey);
  const initMetasSig = await hookProgram.methods
    .initializeExtraAccountMetaList(SSS_TOKEN_PROGRAM_ID)
    .accounts({
      payer: authority.publicKey,
      extraAccountMetaList: extraAccountMetasPda,
      mint: mint.publicKey,
      config: configPda,
    } as any)
    .signers([authority])
    .rpc();

  results["initExtraAccountMetas"] = initMetasSig;
  console.log(`2. Init Extra Account Metas: ${initMetasSig}`);

  // 3. Add minter role + config
  const [minterRolePda] = getRolePda(configPda, 0, authority.publicKey);
  const addMinterRoleSig = await program.methods
    .updateRoles(authority.publicKey, { minter: {} } as any, { assign: {} })
    .accounts({
      authority: authority.publicKey,
      config: configPda,
      roleAssignment: minterRolePda,
    } as any)
    .signers([authority])
    .rpc();

  results["addMinterRole"] = addMinterRoleSig;
  console.log(`3. Add Minter Role: ${addMinterRoleSig}`);

  const [minterPda] = getMinterPda(configPda, authority.publicKey);
  const addMinterSig = await program.methods
    .updateMinter(authority.publicKey, { add: { quota: new BN(1_000_000_000_000) } })
    .accounts({
      authority: authority.publicKey,
      config: configPda,
      minterConfig: minterPda,
    } as any)
    .signers([authority])
    .rpc();

  results["addMinterConfig"] = addMinterSig;
  console.log(`4. Add Minter Config: ${addMinterSig}`);

  // 4. Create ATA and mint tokens
  const ata = getAssociatedTokenAddressSync(
    mint.publicKey, authority.publicKey, true,
    TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const createAtaTx = new anchor.web3.Transaction().add(
    createAssociatedTokenAccountInstruction(
      authority.publicKey, ata, authority.publicKey, mint.publicKey,
      TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );
  const createAtaSig = await anchor.web3.sendAndConfirmTransaction(connection, createAtaTx, [authority]);
  results["createATA"] = createAtaSig;
  console.log(`5. Create ATA: ${createAtaSig}`);

  const mintSig = await program.methods
    .mint(new BN(1_000_000_000)) // 1000 tokens
    .accounts({
      minter: authority.publicKey,
      config: configPda,
      roleAssignment: minterRolePda,
      minterConfig: minterPda,
      mint: mint.publicKey,
      recipientTokenAccount: ata,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    } as any)
    .signers([authority])
    .rpc();

  results["mint"] = mintSig;
  console.log(`6. Mint 1000 SDUSD: ${mintSig}`);

  // 5. Add pauser role and pause
  const [pauserRolePda] = getRolePda(configPda, 2, authority.publicKey);
  const addPauserSig = await program.methods
    .updateRoles(authority.publicKey, { pauser: {} } as any, { assign: {} })
    .accounts({
      authority: authority.publicKey,
      config: configPda,
      roleAssignment: pauserRolePda,
    } as any)
    .signers([authority])
    .rpc();

  results["addPauserRole"] = addPauserSig;
  console.log(`7. Add Pauser Role: ${addPauserSig}`);

  const pauseSig = await program.methods
    .pause()
    .accounts({
      pauser: authority.publicKey,
      config: configPda,
      roleAssignment: pauserRolePda,
    } as any)
    .signers([authority])
    .rpc();

  results["pause"] = pauseSig;
  console.log(`8. Pause: ${pauseSig}`);

  const unpauseSig = await program.methods
    .unpause()
    .accounts({
      pauser: authority.publicKey,
      config: configPda,
      roleAssignment: pauserRolePda,
    } as any)
    .signers([authority])
    .rpc();

  results["unpause"] = unpauseSig;
  console.log(`9. Unpause: ${unpauseSig}`);

  // Summary
  console.log("\n=== Devnet Deployment Summary ===");
  console.log(`SSS Token Program: ${SSS_TOKEN_PROGRAM_ID.toBase58()}`);
  console.log(`Transfer Hook Program: ${TRANSFER_HOOK_PROGRAM_ID.toBase58()}`);
  console.log(`Mint: ${mint.publicKey.toBase58()}`);
  console.log(`Config PDA: ${configPda.toBase58()}`);
  console.log("\nTransaction Signatures:");
  for (const [name, sig] of Object.entries(results)) {
    console.log(`  ${name}: ${sig}`);
  }

  console.log("\nVerify on Solana Explorer:");
  for (const [name, sig] of Object.entries(results)) {
    console.log(`  ${name}: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  }
}

main().catch(console.error);
