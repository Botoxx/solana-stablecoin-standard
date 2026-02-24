import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import { SssToken } from "../target/types/sss_token";
import {
  airdropSol,
  createStablecoin,
  createTokenAccount,
  addMinter,
  mintTokens,
  assignRole,
  assertError,
  getTokenBalance,
  getConfigPda,
  getRolePda,
  getMinterPda,
  RoleType,
} from "./helpers";

describe("Security Invariants", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SssToken as Program<SssToken>;
  const connection = provider.connection;

  const authority = Keypair.generate();
  const minterKeypair = Keypair.generate();
  const userA = Keypair.generate();
  const userB = Keypair.generate();

  let mint: Keypair;
  let configPda: PublicKey;
  let userATokenAccount: PublicKey;
  let userBTokenAccount: PublicKey;

  const DECIMALS = 6;
  const ONE_TOKEN = new anchor.BN(1_000_000);
  const MINTER_QUOTA = new anchor.BN(100_000_000);

  before(async () => {
    await Promise.all([
      airdropSol(connection, authority.publicKey),
      airdropSol(connection, minterKeypair.publicKey),
      airdropSol(connection, userA.publicKey),
      airdropSol(connection, userB.publicKey),
    ]);

    const result = await createStablecoin(program, null, authority, {
      decimals: DECIMALS,
    });
    mint = result.mint;
    configPda = result.configPda;

    await addMinter(
      program,
      authority,
      configPda,
      minterKeypair.publicKey,
      MINTER_QUOTA
    );

    await assignRole(
      program,
      authority,
      configPda,
      userA.publicKey,
      RoleType.Burner
    );

    userATokenAccount = await createTokenAccount(
      connection,
      authority,
      mint.publicKey,
      userA.publicKey
    );
    userBTokenAccount = await createTokenAccount(
      connection,
      authority,
      mint.publicKey,
      userB.publicKey
    );
  });

  it("supply conservation: totalMinted - totalBurned == sum(balances)", async () => {
    const mintAmount = ONE_TOKEN.mul(new anchor.BN(20));
    await mintTokens(
      program,
      minterKeypair,
      configPda,
      mint.publicKey,
      userATokenAccount,
      mintAmount
    );

    // Transfer some
    const { createTransferCheckedInstruction } = await import(
      "@solana/spl-token"
    );
    const transferIx = createTransferCheckedInstruction(
      userATokenAccount,
      mint.publicKey,
      userBTokenAccount,
      userA.publicKey,
      BigInt(ONE_TOKEN.mul(new anchor.BN(5)).toString()),
      DECIMALS,
      [],
      TOKEN_2022_PROGRAM_ID
    );
    const tx = new anchor.web3.Transaction().add(transferIx);
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [userA]);

    // Burn some
    const burnAmount = ONE_TOKEN.mul(new anchor.BN(3));
    const [burnerRolePda] = getRolePda(
      configPda,
      RoleType.Burner,
      userA.publicKey
    );
    await program.methods
      .burn(burnAmount)
      .accounts({
        burner: userA.publicKey,
        config: configPda,
        roleAssignment: burnerRolePda,
        mint: mint.publicKey,
        burnerTokenAccount: userATokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([userA])
      .rpc();

    const config = await program.account.stablecoinConfig.fetch(configPda);
    const netSupply =
      config.totalMinted.toNumber() - config.totalBurned.toNumber();

    const balA = await getTokenBalance(connection, userATokenAccount);
    const balB = await getTokenBalance(connection, userBTokenAccount);
    const totalBalances = Number(balA) + Number(balB);

    expect(netSupply).to.equal(totalBalances);
  });

  it("quota monotonicity: quota_remaining <= quota_total", async () => {
    const [minterPda] = getMinterPda(configPda, minterKeypair.publicKey);
    const minterConfig = await program.account.minterConfig.fetch(minterPda);
    expect(minterConfig.quotaRemaining.toNumber()).to.be.at.most(
      minterConfig.quotaTotal.toNumber()
    );
  });

  it("freeze enforcement: frozen account cannot send", async () => {
    // Freeze user B
    await program.methods
      .freezeAccount()
      .accounts({
        authority: authority.publicKey,
        config: configPda,
        mint: mint.publicKey,
        tokenAccount: userBTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    const { createTransferCheckedInstruction } = await import(
      "@solana/spl-token"
    );
    await assertError(async () => {
      const transferIx = createTransferCheckedInstruction(
        userBTokenAccount,
        mint.publicKey,
        userATokenAccount,
        userB.publicKey,
        BigInt(ONE_TOKEN.toString()),
        DECIMALS,
        [],
        TOKEN_2022_PROGRAM_ID
      );
      const tx = new anchor.web3.Transaction().add(transferIx);
      await anchor.web3.sendAndConfirmTransaction(connection, tx, [userB]);
    });

    // Thaw for subsequent tests
    await program.methods
      .thawAccount()
      .accounts({
        authority: authority.publicKey,
        config: configPda,
        mint: mint.publicKey,
        tokenAccount: userBTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();
  });

  it("role exclusivity: wrong role type fails", async () => {
    // userA has Burner role — trying to use as Pauser should fail
    const [pauserRolePda] = getRolePda(
      configPda,
      RoleType.Pauser,
      userA.publicKey
    );

    await assertError(async () => {
      await program.methods
        .pause()
        .accounts({
          pauser: userA.publicKey,
          config: configPda,
          roleAssignment: pauserRolePda,
        })
        .signers([userA])
        .rpc();
    });
  });

  it("authority immutability: config.authority unchanged after non-authority ops", async () => {
    const beforeConfig = await program.account.stablecoinConfig.fetch(
      configPda
    );

    // Mint operation
    await mintTokens(
      program,
      minterKeypair,
      configPda,
      mint.publicKey,
      userATokenAccount,
      ONE_TOKEN
    );

    const afterConfig = await program.account.stablecoinConfig.fetch(configPda);
    expect(afterConfig.authority.toString()).to.equal(
      beforeConfig.authority.toString()
    );
  });

  it("mint amount zero fails", async () => {
    await assertError(async () => {
      await mintTokens(
        program,
        minterKeypair,
        configPda,
        mint.publicKey,
        userATokenAccount,
        new anchor.BN(0)
      );
    }, "InvalidAmount");
  });
});
