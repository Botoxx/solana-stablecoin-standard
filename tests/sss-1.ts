import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
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

describe("SSS-1 Minimal Preset", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SssToken as Program<SssToken>;
  const connection = provider.connection;

  const authority = Keypair.generate();
  const minterKeypair = Keypair.generate();
  const burnerKeypair = Keypair.generate();
  const pauserKeypair = Keypair.generate();
  const userA = Keypair.generate();
  const userB = Keypair.generate();
  const newAuthority = Keypair.generate();

  let mint: Keypair;
  let configPda: PublicKey;
  let userATokenAccount: PublicKey;
  let userBTokenAccount: PublicKey;
  let burnerTokenAccount: PublicKey;

  const DECIMALS = 6;
  const ONE_TOKEN = new anchor.BN(1_000_000);
  const MINTER_QUOTA = new anchor.BN(100_000_000); // 100 tokens

  before(async () => {
    // Airdrop to all accounts
    await Promise.all([
      airdropSol(connection, authority.publicKey),
      airdropSol(connection, minterKeypair.publicKey),
      airdropSol(connection, burnerKeypair.publicKey),
      airdropSol(connection, pauserKeypair.publicKey),
      airdropSol(connection, userA.publicKey),
      airdropSol(connection, userB.publicKey),
      airdropSol(connection, newAuthority.publicKey),
    ]);
  });

  it("initializes SSS-1 stablecoin", async () => {
    const result = await createStablecoin(program, null, authority, {
      name: "Test USD",
      symbol: "TUSD",
      uri: "https://example.com/tusd.json",
      decimals: DECIMALS,
      enablePermanentDelegate: false,
      enableTransferHook: false,
      defaultAccountFrozen: false,
    });

    mint = result.mint;
    configPda = result.configPda;
  });

  it("verifies config PDA state", async () => {
    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.authority.toString()).to.equal(authority.publicKey.toString());
    expect(config.mint.toString()).to.equal(mint.publicKey.toString());
    expect(config.decimals).to.equal(DECIMALS);
    expect(config.paused).to.be.false;
    expect(config.enablePermanentDelegate).to.be.false;
    expect(config.enableTransferHook).to.be.false;
    expect(config.totalMinted.toNumber()).to.equal(0);
    expect(config.totalBurned.toNumber()).to.equal(0);
  });

  it("adds minter with quota", async () => {
    await addMinter(
      program,
      authority,
      configPda,
      minterKeypair.publicKey,
      MINTER_QUOTA
    );

    const [minterPda] = getMinterPda(configPda, minterKeypair.publicKey);
    const minterConfig = await program.account.minterConfig.fetch(minterPda);
    expect(minterConfig.quotaTotal.toString()).to.equal(MINTER_QUOTA.toString());
    expect(minterConfig.quotaRemaining.toString()).to.equal(
      MINTER_QUOTA.toString()
    );
  });

  it("creates token accounts for users", async () => {
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
    burnerTokenAccount = await createTokenAccount(
      connection,
      authority,
      mint.publicKey,
      burnerKeypair.publicKey
    );
  });

  it("mints tokens to user A", async () => {
    const amount = ONE_TOKEN.mul(new anchor.BN(10)); // 10 tokens
    await mintTokens(
      program,
      minterKeypair,
      configPda,
      mint.publicKey,
      userATokenAccount,
      amount
    );

    const balance = await getTokenBalance(connection, userATokenAccount);
    expect(balance.toString()).to.equal(amount.toString());
  });

  it("verifies minter quota decreased", async () => {
    const [minterPda] = getMinterPda(configPda, minterKeypair.publicKey);
    const minterConfig = await program.account.minterConfig.fetch(minterPda);
    const expected = MINTER_QUOTA.sub(ONE_TOKEN.mul(new anchor.BN(10)));
    expect(minterConfig.quotaRemaining.toString()).to.equal(expected.toString());
  });

  it("fails to mint — unauthorized (non-minter)", async () => {
    await assertError(async () => {
      await mintTokens(
        program,
        userA, // not a minter
        configPda,
        mint.publicKey,
        userATokenAccount,
        ONE_TOKEN
      );
    });
  });

  it("fails to mint — quota exceeded", async () => {
    const hugeAmount = new anchor.BN(999_000_000_000); // way over quota
    await assertError(async () => {
      await mintTokens(
        program,
        minterKeypair,
        configPda,
        mint.publicKey,
        userATokenAccount,
        hugeAmount
      );
    }, "QuotaExceeded");
  });

  it("assigns burner role and burns tokens", async () => {
    // Assign burner role
    await assignRole(
      program,
      authority,
      configPda,
      burnerKeypair.publicKey,
      RoleType.Burner
    );

    // Mint tokens to burner so they have something to burn
    await mintTokens(
      program,
      minterKeypair,
      configPda,
      mint.publicKey,
      burnerTokenAccount,
      ONE_TOKEN.mul(new anchor.BN(5))
    );

    // Burn 2 tokens
    const burnAmount = ONE_TOKEN.mul(new anchor.BN(2));
    const [rolePda] = getRolePda(
      configPda,
      RoleType.Burner,
      burnerKeypair.publicKey
    );

    await program.methods
      .burn(burnAmount)
      .accounts({
        burner: burnerKeypair.publicKey,
        config: configPda,
        roleAssignment: rolePda,
        mint: mint.publicKey,
        burnerTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([burnerKeypair])
      .rpc();

    const balance = await getTokenBalance(connection, burnerTokenAccount);
    expect(balance.toString()).to.equal(
      ONE_TOKEN.mul(new anchor.BN(3)).toString()
    );
  });

  it("fails to burn — unauthorized", async () => {
    await assertError(async () => {
      const [rolePda] = getRolePda(
        configPda,
        RoleType.Burner,
        userA.publicKey
      );

      await program.methods
        .burn(ONE_TOKEN)
        .accounts({
          burner: userA.publicKey,
          config: configPda,
          roleAssignment: rolePda,
          mint: mint.publicKey,
          burnerTokenAccount: userATokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([userA])
        .rpc();
    });
  });

  it("transfers tokens between accounts (standard)", async () => {
    // SSS-1 has no transfer hook — use standard transferChecked
    const amount = ONE_TOKEN.mul(new anchor.BN(2));

    // Create transfer instruction for Token-2022
    const ix = anchor.web3.SystemProgram.transfer({
      fromPubkey: userA.publicKey,
      toPubkey: userA.publicKey,
      lamports: 0,
    });

    // Use the spl-token transferChecked
    const { createTransferCheckedInstruction } = await import(
      "@solana/spl-token"
    );
    const transferIx = createTransferCheckedInstruction(
      userATokenAccount,
      mint.publicKey,
      userBTokenAccount,
      userA.publicKey,
      BigInt(amount.toString()),
      DECIMALS,
      [],
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new anchor.web3.Transaction().add(transferIx);
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [userA]);

    const balA = await getTokenBalance(connection, userATokenAccount);
    const balB = await getTokenBalance(connection, userBTokenAccount);
    expect(balA.toString()).to.equal(
      ONE_TOKEN.mul(new anchor.BN(8)).toString()
    ); // 10 - 2
    expect(balB.toString()).to.equal(amount.toString()); // 2
  });

  it("freezes a token account", async () => {
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
  });

  it("fails to transfer — frozen account", async () => {
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
  });

  it("thaws a token account", async () => {
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

  it("transfers succeed after thaw", async () => {
    const { createTransferCheckedInstruction } = await import(
      "@solana/spl-token"
    );
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

    const balB = await getTokenBalance(connection, userBTokenAccount);
    expect(balB.toString()).to.equal(ONE_TOKEN.toString()); // 2 - 1 = 1
  });

  it("assigns pauser role and pauses", async () => {
    await assignRole(
      program,
      authority,
      configPda,
      pauserKeypair.publicKey,
      RoleType.Pauser
    );

    const [rolePda] = getRolePda(
      configPda,
      RoleType.Pauser,
      pauserKeypair.publicKey
    );

    await program.methods
      .pause()
      .accounts({
        pauser: pauserKeypair.publicKey,
        config: configPda,
        roleAssignment: rolePda,
      })
      .signers([pauserKeypair])
      .rpc();

    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.paused).to.be.true;
  });

  it("fails to mint while paused", async () => {
    await assertError(async () => {
      await mintTokens(
        program,
        minterKeypair,
        configPda,
        mint.publicKey,
        userATokenAccount,
        ONE_TOKEN
      );
    }, "Paused");
  });

  it("unpauses", async () => {
    const [rolePda] = getRolePda(
      configPda,
      RoleType.Pauser,
      pauserKeypair.publicKey
    );

    await program.methods
      .unpause()
      .accounts({
        pauser: pauserKeypair.publicKey,
        config: configPda,
        roleAssignment: rolePda,
      })
      .signers([pauserKeypair])
      .rpc();

    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.paused).to.be.false;
  });

  it("proposes and accepts authority transfer", async () => {
    // Propose
    await program.methods
      .proposeAuthority(newAuthority.publicKey)
      .accounts({
        authority: authority.publicKey,
        config: configPda,
      })
      .signers([authority])
      .rpc();

    let config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.pendingAuthority?.toString()).to.equal(
      newAuthority.publicKey.toString()
    );

    // Accept
    await program.methods
      .acceptAuthority()
      .accounts({
        newAuthority: newAuthority.publicKey,
        config: configPda,
      })
      .signers([newAuthority])
      .rpc();

    config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.authority.toString()).to.equal(
      newAuthority.publicKey.toString()
    );
    expect(config.pendingAuthority).to.be.null;
  });

  it("verifies total minted and burned audit trail", async () => {
    const config = await program.account.stablecoinConfig.fetch(configPda);
    // 10 tokens to userA + 5 tokens to burner = 15 tokens minted
    expect(config.totalMinted.toString()).to.equal(
      ONE_TOKEN.mul(new anchor.BN(15)).toString()
    );
    // 2 tokens burned
    expect(config.totalBurned.toString()).to.equal(
      ONE_TOKEN.mul(new anchor.BN(2)).toString()
    );
  });
});
