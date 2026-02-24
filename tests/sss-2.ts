import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";
import { SssToken } from "../target/types/sss_token";
import { TransferHook } from "../target/types/transfer_hook";
import {
  airdropSol,
  createStablecoin,
  createTokenAccount,
  addMinter,
  mintTokens,
  assignRole,
  assertError,
  getTokenBalance,
  transferWithHook,
  getConfigPda,
  getRolePda,
  getBlacklistPda,
  RoleType,
} from "./helpers";

describe("SSS-2 Compliant Preset", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SssToken as Program<SssToken>;
  const hookProgram = anchor.workspace.TransferHook as Program<TransferHook>;
  const connection = provider.connection;

  const authority = Keypair.generate();
  const minterKeypair = Keypair.generate();
  const blacklisterKeypair = Keypair.generate();
  const seizerKeypair = Keypair.generate();
  const userA = Keypair.generate();
  const userB = Keypair.generate();
  const treasury = Keypair.generate();

  let mint: Keypair;
  let configPda: PublicKey;
  let userATokenAccount: PublicKey;
  let userBTokenAccount: PublicKey;
  let treasuryTokenAccount: PublicKey;

  const DECIMALS = 6;
  const ONE_TOKEN = new anchor.BN(1_000_000);
  const MINTER_QUOTA = new anchor.BN(1_000_000_000); // 1000 tokens

  before(async () => {
    await Promise.all([
      airdropSol(connection, authority.publicKey),
      airdropSol(connection, minterKeypair.publicKey),
      airdropSol(connection, blacklisterKeypair.publicKey),
      airdropSol(connection, seizerKeypair.publicKey),
      airdropSol(connection, userA.publicKey),
      airdropSol(connection, userB.publicKey),
      airdropSol(connection, treasury.publicKey),
    ]);
  });

  it("initializes SSS-2 stablecoin with compliance extensions", async () => {
    const result = await createStablecoin(program, hookProgram, authority, {
      name: "Compliant USD",
      symbol: "cUSD",
      uri: "https://example.com/cusd.json",
      decimals: DECIMALS,
      enablePermanentDelegate: true,
      enableTransferHook: true,
      defaultAccountFrozen: false,
      treasury: treasury.publicKey,
    });

    mint = result.mint;
    configPda = result.configPda;
  });

  it("verifies SSS-2 config state", async () => {
    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.enablePermanentDelegate).to.be.true;
    expect(config.enableTransferHook).to.be.true;
    expect(config.treasury.toString()).to.equal(treasury.publicKey.toString());
  });

  it("assigns blacklister role", async () => {
    await assignRole(
      program,
      authority,
      configPda,
      blacklisterKeypair.publicKey,
      RoleType.Blacklister
    );
  });

  it("assigns seizer role", async () => {
    await assignRole(
      program,
      authority,
      configPda,
      seizerKeypair.publicKey,
      RoleType.Seizer
    );
  });

  it("adds minter and creates token accounts", async () => {
    await addMinter(
      program,
      authority,
      configPda,
      minterKeypair.publicKey,
      MINTER_QUOTA
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
    treasuryTokenAccount = await createTokenAccount(
      connection,
      authority,
      mint.publicKey,
      treasury.publicKey
    );
  });

  it("mints tokens to users", async () => {
    const amount = ONE_TOKEN.mul(new anchor.BN(50));
    await mintTokens(
      program,
      minterKeypair,
      configPda,
      mint.publicKey,
      userATokenAccount,
      amount
    );
    await mintTokens(
      program,
      minterKeypair,
      configPda,
      mint.publicKey,
      userBTokenAccount,
      amount
    );
  });

  it("transfers succeed between non-blacklisted accounts", async () => {
    const amount = ONE_TOKEN.mul(new anchor.BN(5));
    await transferWithHook(
      connection,
      userA,
      userATokenAccount,
      mint.publicKey,
      userBTokenAccount,
      userA,
      Number(amount.toString()),
      DECIMALS
    );

    const balB = await getTokenBalance(connection, userBTokenAccount);
    expect(balB.toString()).to.equal(
      ONE_TOKEN.mul(new anchor.BN(55)).toString()
    );
  });

  it("blacklists sender with reason", async () => {
    const [rolePda] = getRolePda(
      configPda,
      RoleType.Blacklister,
      blacklisterKeypair.publicKey
    );
    const [blacklistPda] = getBlacklistPda(configPda, userA.publicKey);

    await program.methods
      .addToBlacklist(userA.publicKey, "OFAC SDN match")
      .accounts({
        blacklister: blacklisterKeypair.publicKey,
        config: configPda,
        roleAssignment: rolePda,
        blacklistEntry: blacklistPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([blacklisterKeypair])
      .rpc();

    const entry = await program.account.blacklistEntry.fetch(blacklistPda);
    expect(entry.active).to.be.true;
    expect(entry.reason).to.equal("OFAC SDN match");
    expect(entry.address.toString()).to.equal(userA.publicKey.toString());
  });

  it("transfer fails — sender blacklisted", async () => {
    await assertError(async () => {
      await transferWithHook(
        connection,
        userA,
        userATokenAccount,
        mint.publicKey,
        userBTokenAccount,
        userA,
        Number(ONE_TOKEN.toString()),
        DECIMALS
      );
    });
  });

  it("blacklists recipient", async () => {
    const [rolePda] = getRolePda(
      configPda,
      RoleType.Blacklister,
      blacklisterKeypair.publicKey
    );
    const [blacklistPda] = getBlacklistPda(configPda, userB.publicKey);

    await program.methods
      .addToBlacklist(userB.publicKey, "Sanctions screening")
      .accounts({
        blacklister: blacklisterKeypair.publicKey,
        config: configPda,
        roleAssignment: rolePda,
        blacklistEntry: blacklistPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([blacklisterKeypair])
      .rpc();
  });

  it("removes sender from blacklist", async () => {
    const [rolePda] = getRolePda(
      configPda,
      RoleType.Blacklister,
      blacklisterKeypair.publicKey
    );
    const [blacklistPda] = getBlacklistPda(configPda, userA.publicKey);

    await program.methods
      .removeFromBlacklist(userA.publicKey)
      .accounts({
        blacklister: blacklisterKeypair.publicKey,
        config: configPda,
        roleAssignment: rolePda,
        blacklistEntry: blacklistPda,
      })
      .signers([blacklisterKeypair])
      .rpc();

    const entry = await program.account.blacklistEntry.fetch(blacklistPda);
    expect(entry.active).to.be.false;
  });

  it("transfer still fails — recipient blacklisted", async () => {
    await assertError(async () => {
      await transferWithHook(
        connection,
        userA,
        userATokenAccount,
        mint.publicKey,
        userBTokenAccount,
        userA,
        Number(ONE_TOKEN.toString()),
        DECIMALS
      );
    });
  });

  it("removes recipient from blacklist", async () => {
    const [rolePda] = getRolePda(
      configPda,
      RoleType.Blacklister,
      blacklisterKeypair.publicKey
    );
    const [blacklistPda] = getBlacklistPda(configPda, userB.publicKey);

    await program.methods
      .removeFromBlacklist(userB.publicKey)
      .accounts({
        blacklister: blacklisterKeypair.publicKey,
        config: configPda,
        roleAssignment: rolePda,
        blacklistEntry: blacklistPda,
      })
      .signers([blacklisterKeypair])
      .rpc();
  });

  it("transfer succeeds after unblacklisting both", async () => {
    await transferWithHook(
      connection,
      userA,
      userATokenAccount,
      mint.publicKey,
      userBTokenAccount,
      userA,
      Number(ONE_TOKEN.toString()),
      DECIMALS
    );
  });

  it("freezes target account for seizure", async () => {
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

  it("seizes tokens from frozen account to treasury", async () => {
    const seizeAmount = ONE_TOKEN.mul(new anchor.BN(10));
    const [rolePda] = getRolePda(
      configPda,
      RoleType.Seizer,
      seizerKeypair.publicKey
    );

    const beforeBal = await getTokenBalance(connection, treasuryTokenAccount);

    await program.methods
      .seize(seizeAmount)
      .accounts({
        seizer: seizerKeypair.publicKey,
        config: configPda,
        roleAssignment: rolePda,
        mint: mint.publicKey,
        sourceTokenAccount: userBTokenAccount,
        treasuryTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([seizerKeypair])
      .rpc();

    const afterBal = await getTokenBalance(connection, treasuryTokenAccount);
    expect((afterBal - beforeBal).toString()).to.equal(seizeAmount.toString());
  });

  it("fails to seize — account not frozen", async () => {
    // Thaw first
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

    const [rolePda] = getRolePda(
      configPda,
      RoleType.Seizer,
      seizerKeypair.publicKey
    );

    await assertError(async () => {
      await program.methods
        .seize(ONE_TOKEN)
        .accounts({
          seizer: seizerKeypair.publicKey,
          config: configPda,
          roleAssignment: rolePda,
          mint: mint.publicKey,
          sourceTokenAccount: userBTokenAccount,
          treasuryTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([seizerKeypair])
        .rpc();
    }, "AccountNotFrozen");
  });

  it("fails to seize — unauthorized (non-seizer)", async () => {
    // Freeze again
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

    await assertError(async () => {
      const [fakePda] = getRolePda(
        configPda,
        RoleType.Seizer,
        userA.publicKey
      );
      await program.methods
        .seize(ONE_TOKEN)
        .accounts({
          seizer: userA.publicKey,
          config: configPda,
          roleAssignment: fakePda,
          mint: mint.publicKey,
          sourceTokenAccount: userBTokenAccount,
          treasuryTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([userA])
        .rpc();
    });
  });

  it("fails to blacklist — unauthorized (non-blacklister)", async () => {
    await assertError(async () => {
      const [fakePda] = getRolePda(
        configPda,
        RoleType.Blacklister,
        userA.publicKey
      );
      const [blacklistPda] = getBlacklistPda(configPda, userB.publicKey);

      await program.methods
        .addToBlacklist(userB.publicKey, "unauthorized attempt")
        .accounts({
          blacklister: userA.publicKey,
          config: configPda,
          roleAssignment: fakePda,
          blacklistEntry: blacklistPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([userA])
        .rpc();
    });
  });
});
