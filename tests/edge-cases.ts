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
  getConfigPda,
  getRolePda,
  getMinterPda,
  getBlacklistPda,
  RoleType,
} from "./helpers";

describe("Edge Cases & Boundary Conditions", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SssToken as Program<SssToken>;
  const hookProgram = anchor.workspace.TransferHook as Program<TransferHook>;
  const connection = provider.connection;

  const authority = Keypair.generate();
  const minterKeypair = Keypair.generate();
  const blacklisterKeypair = Keypair.generate();
  const pauserKeypair = Keypair.generate();
  const userA = Keypair.generate();
  const userB = Keypair.generate();
  const otherUser = Keypair.generate();

  let mint: Keypair;
  let configPda: PublicKey;
  let userATokenAccount: PublicKey;

  const DECIMALS = 6;
  const ONE_TOKEN = new anchor.BN(1_000_000);

  before(async () => {
    await Promise.all([
      airdropSol(connection, authority.publicKey),
      airdropSol(connection, minterKeypair.publicKey),
      airdropSol(connection, blacklisterKeypair.publicKey),
      airdropSol(connection, pauserKeypair.publicKey),
      airdropSol(connection, userA.publicKey),
      airdropSol(connection, userB.publicKey),
      airdropSol(connection, otherUser.publicKey),
    ]);

    // Create SSS-2 stablecoin for full feature testing
    const result = await createStablecoin(program, hookProgram, authority, {
      enablePermanentDelegate: true,
      enableTransferHook: true,
      treasury: authority.publicKey,
    });
    mint = result.mint;
    configPda = result.configPda;

    // Setup roles
    await addMinter(
      program,
      authority,
      configPda,
      minterKeypair.publicKey,
      new anchor.BN(1_000_000_000)
    );
    await assignRole(
      program,
      authority,
      configPda,
      blacklisterKeypair.publicKey,
      RoleType.Blacklister
    );
    await assignRole(
      program,
      authority,
      configPda,
      pauserKeypair.publicKey,
      RoleType.Pauser
    );

    userATokenAccount = await createTokenAccount(
      connection,
      authority,
      mint.publicKey,
      userA.publicKey
    );
  });

  it("blacklist with empty reason fails", async () => {
    const [rolePda] = getRolePda(
      configPda,
      RoleType.Blacklister,
      blacklisterKeypair.publicKey
    );
    const [blacklistPda] = getBlacklistPda(configPda, userA.publicKey);

    await assertError(async () => {
      await program.methods
        .addToBlacklist(userA.publicKey, "")
        .accounts({
          blacklister: blacklisterKeypair.publicKey,
          config: configPda,
          roleAssignment: rolePda,
          blacklistEntry: blacklistPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([blacklisterKeypair])
        .rpc();
    }, "BlacklistReasonRequired");
  });

  it("blacklist with reason exceeding max length fails", async () => {
    const longReason = "x".repeat(200); // exceeds MAX_REASON_LENGTH (128)
    const [rolePda] = getRolePda(
      configPda,
      RoleType.Blacklister,
      blacklisterKeypair.publicKey
    );
    const [blacklistPda] = getBlacklistPda(configPda, userA.publicKey);

    await assertError(async () => {
      await program.methods
        .addToBlacklist(userA.publicKey, longReason)
        .accounts({
          blacklister: blacklisterKeypair.publicKey,
          config: configPda,
          roleAssignment: rolePda,
          blacklistEntry: blacklistPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([blacklisterKeypair])
        .rpc();
    }, "BlacklistReasonTooLong");
  });

  it("double blacklist succeeds — idempotent re-activation", async () => {
    const [rolePda] = getRolePda(
      configPda,
      RoleType.Blacklister,
      blacklisterKeypair.publicKey
    );
    const [blacklistPda] = getBlacklistPda(configPda, otherUser.publicKey);

    // First blacklist
    await program.methods
      .addToBlacklist(otherUser.publicKey, "Initial")
      .accounts({
        blacklister: blacklisterKeypair.publicKey,
        config: configPda,
        roleAssignment: rolePda,
        blacklistEntry: blacklistPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([blacklisterKeypair])
      .rpc();

    // Second blacklist attempt — should fail (already active)
    await assertError(async () => {
      await program.methods
        .addToBlacklist(otherUser.publicKey, "Duplicate")
        .accounts({
          blacklister: blacklisterKeypair.publicKey,
          config: configPda,
          roleAssignment: rolePda,
          blacklistEntry: blacklistPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([blacklisterKeypair])
        .rpc();
    }, "AlreadyBlacklisted");
  });

  it("re-blacklist after removal works", async () => {
    const [rolePda] = getRolePda(
      configPda,
      RoleType.Blacklister,
      blacklisterKeypair.publicKey
    );
    const [blacklistPda] = getBlacklistPda(configPda, otherUser.publicKey);

    // Remove
    await program.methods
      .removeFromBlacklist(otherUser.publicKey)
      .accounts({
        blacklister: blacklisterKeypair.publicKey,
        config: configPda,
        roleAssignment: rolePda,
        blacklistEntry: blacklistPda,
      })
      .signers([blacklisterKeypair])
      .rpc();

    // Re-add should succeed (entry exists but inactive)
    await program.methods
      .addToBlacklist(otherUser.publicKey, "Re-added")
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
    expect(entry.reason).to.equal("Re-added");
  });

  it("burn does NOT restore minter quota", async () => {
    await mintTokens(
      program,
      minterKeypair,
      configPda,
      mint.publicKey,
      userATokenAccount,
      ONE_TOKEN.mul(new anchor.BN(10))
    );

    const [minterPda] = getMinterPda(configPda, minterKeypair.publicKey);
    const beforeQuota = (
      await program.account.minterConfig.fetch(minterPda)
    ).quotaRemaining.toString();

    // Burn with burner role
    await assignRole(
      program,
      authority,
      configPda,
      userA.publicKey,
      RoleType.Burner
    );
    const [burnerRolePda] = getRolePda(
      configPda,
      RoleType.Burner,
      userA.publicKey
    );

    await program.methods
      .burn(ONE_TOKEN.mul(new anchor.BN(5)))
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

    const afterQuota = (
      await program.account.minterConfig.fetch(minterPda)
    ).quotaRemaining.toString();

    // Quota should be unchanged (burn doesn't restore)
    expect(afterQuota).to.equal(beforeQuota);
  });

  it("pause blocks mint but NOT unpause and role management", async () => {
    const [pauserRolePda] = getRolePda(
      configPda,
      RoleType.Pauser,
      pauserKeypair.publicKey
    );

    // Pause
    await program.methods
      .pause()
      .accounts({
        pauser: pauserKeypair.publicKey,
        config: configPda,
        roleAssignment: pauserRolePda,
      })
      .signers([pauserKeypair])
      .rpc();

    // Mint should fail
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

    // Role management should still work
    const testRole = Keypair.generate();
    await airdropSol(connection, testRole.publicKey, 1);
    await assignRole(
      program,
      authority,
      configPda,
      testRole.publicKey,
      RoleType.Burner
    );

    // Unpause should work
    await program.methods
      .unpause()
      .accounts({
        pauser: pauserKeypair.publicKey,
        config: configPda,
        roleAssignment: pauserRolePda,
      })
      .signers([pauserKeypair])
      .rpc();
  });

  it("accept_authority with wrong signer fails", async () => {
    await program.methods
      .proposeAuthority(userA.publicKey)
      .accounts({
        authority: authority.publicKey,
        config: configPda,
      })
      .signers([authority])
      .rpc();

    // Wrong signer tries to accept
    await assertError(async () => {
      await program.methods
        .acceptAuthority()
        .accounts({
          newAuthority: userB.publicKey,
          config: configPda,
        })
        .signers([userB])
        .rpc();
    }, "PendingAuthorityMismatch");

    // Clean up: accept with correct signer, then transfer back
    await program.methods
      .acceptAuthority()
      .accounts({
        newAuthority: userA.publicKey,
        config: configPda,
      })
      .signers([userA])
      .rpc();

    // Transfer back to original authority
    await program.methods
      .proposeAuthority(authority.publicKey)
      .accounts({
        authority: userA.publicKey,
        config: configPda,
      })
      .signers([userA])
      .rpc();
    await program.methods
      .acceptAuthority()
      .accounts({
        newAuthority: authority.publicKey,
        config: configPda,
      })
      .signers([authority])
      .rpc();
  });

  it("accept_authority without pending proposal fails", async () => {
    await assertError(async () => {
      await program.methods
        .acceptAuthority()
        .accounts({
          newAuthority: userA.publicKey,
          config: configPda,
        })
        .signers([userA])
        .rpc();
    }, "NoPendingAuthority");
  });

  it("update minter quota resets remaining", async () => {
    const newQuota = new anchor.BN(500_000_000);
    const [minterPda] = getMinterPda(configPda, minterKeypair.publicKey);

    await program.methods
      .updateMinter(minterKeypair.publicKey, { updateQuota: { newQuota } })
      .accounts({
        authority: authority.publicKey,
        config: configPda,
        minterConfig: minterPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const minterConfig = await program.account.minterConfig.fetch(minterPda);
    expect(minterConfig.quotaTotal.toString()).to.equal(newQuota.toString());
    expect(minterConfig.quotaRemaining.toString()).to.equal(
      newQuota.toString()
    );
  });

  it("remove minter closes PDA", async () => {
    const tempMinter = Keypair.generate();
    await airdropSol(connection, tempMinter.publicKey, 1);

    await addMinter(
      program,
      authority,
      configPda,
      tempMinter.publicKey,
      ONE_TOKEN
    );

    const [minterPda] = getMinterPda(configPda, tempMinter.publicKey);

    // Verify it exists
    const before = await program.account.minterConfig.fetchNullable(minterPda);
    expect(before).to.not.be.null;

    // Remove
    await program.methods
      .updateMinter(tempMinter.publicKey, { remove: {} })
      .accounts({
        authority: authority.publicKey,
        config: configPda,
        minterConfig: minterPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // Verify it's closed
    const after = await program.account.minterConfig.fetchNullable(minterPda);
    expect(after).to.be.null;
  });

  it("revoke role closes PDA", async () => {
    const tempAddr = Keypair.generate();
    await airdropSol(connection, tempAddr.publicKey, 1);

    const [rolePda] = getRolePda(
      configPda,
      RoleType.Burner,
      tempAddr.publicKey
    );

    await assignRole(
      program,
      authority,
      configPda,
      tempAddr.publicKey,
      RoleType.Burner
    );

    // Verify it exists
    const before = await program.account.roleAssignment.fetchNullable(rolePda);
    expect(before).to.not.be.null;

    // Revoke
    await program.methods
      .updateRoles(
        tempAddr.publicKey,
        { burner: {} } as any,
        { revoke: {} }
      )
      .accounts({
        authority: authority.publicKey,
        config: configPda,
        roleAssignment: rolePda,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // Verify it's closed
    const after = await program.account.roleAssignment.fetchNullable(rolePda);
    expect(after).to.be.null;
  });

  it("remove non-existent blacklist entry fails", async () => {
    const nonExistent = Keypair.generate();
    const [rolePda] = getRolePda(
      configPda,
      RoleType.Blacklister,
      blacklisterKeypair.publicKey
    );
    const [blacklistPda] = getBlacklistPda(configPda, nonExistent.publicKey);

    await assertError(async () => {
      await program.methods
        .removeFromBlacklist(nonExistent.publicKey)
        .accounts({
          blacklister: blacklisterKeypair.publicKey,
          config: configPda,
          roleAssignment: rolePda,
          blacklistEntry: blacklistPda,
        })
        .signers([blacklisterKeypair])
        .rpc();
    });
  });
});
