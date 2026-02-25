import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import {
  getConfigPda,
  getMinterPda,
  getRolePda,
  getBlacklistPda,
  getExtraAccountMetasPda,
  SSS_TOKEN_PROGRAM_ID,
  TRANSFER_HOOK_PROGRAM_ID,
} from "../src/pda";

describe("SDK — PDA derivation", () => {
  const mint = Keypair.generate().publicKey;
  const config = Keypair.generate().publicKey;
  const addr = Keypair.generate().publicKey;

  it("getConfigPda returns deterministic PDA derived from sss-token program", () => {
    const [pda, bump] = getConfigPda(mint);
    assert.instanceOf(pda, PublicKey);
    assert.isNumber(bump);
    assert.isAtLeast(bump, 0);
    assert.isAtMost(bump, 255);
    // Deterministic — same input produces same output
    const [pda2, bump2] = getConfigPda(mint);
    assert.equal(pda.toBase58(), pda2.toBase58());
    assert.equal(bump, bump2);
    // Verify it's off-curve (valid PDA)
    assert.isFalse(PublicKey.isOnCurve(pda));
  });

  it("getConfigPda uses correct seeds: ['config', mint]", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), mint.toBuffer()],
      SSS_TOKEN_PROGRAM_ID
    );
    const [actual] = getConfigPda(mint);
    assert.equal(actual.toBase58(), expected.toBase58());
  });

  it("getMinterPda uses correct seeds: ['minter', config, minter]", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), config.toBuffer(), addr.toBuffer()],
      SSS_TOKEN_PROGRAM_ID
    );
    const [actual] = getMinterPda(config, addr);
    assert.equal(actual.toBase58(), expected.toBase58());
  });

  it("getRolePda uses correct seeds: ['role', config, roleType, address]", () => {
    for (const role of [0, 1, 2, 3, 4]) {
      const [expected] = PublicKey.findProgramAddressSync(
        [Buffer.from("role"), config.toBuffer(), Buffer.from([role]), addr.toBuffer()],
        SSS_TOKEN_PROGRAM_ID
      );
      const [actual] = getRolePda(config, role, addr);
      assert.equal(actual.toBase58(), expected.toBase58());
    }
  });

  it("different role types produce different PDAs", () => {
    const pdas = [0, 1, 2, 3, 4].map((r) => getRolePda(config, r, addr)[0].toBase58());
    const unique = new Set(pdas);
    assert.equal(unique.size, 5, "all 5 role PDAs should be unique");
  });

  it("getBlacklistPda uses correct seeds: ['blacklist', config, address]", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), config.toBuffer(), addr.toBuffer()],
      SSS_TOKEN_PROGRAM_ID
    );
    const [actual] = getBlacklistPda(config, addr);
    assert.equal(actual.toBase58(), expected.toBase58());
  });

  it("getExtraAccountMetasPda derives from transfer-hook program", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), mint.toBuffer()],
      TRANSFER_HOOK_PROGRAM_ID
    );
    const [actual] = getExtraAccountMetasPda(mint);
    assert.equal(actual.toBase58(), expected.toBase58());
  });

  it("different mints produce different config PDAs", () => {
    const mint2 = Keypair.generate().publicKey;
    const [pda1] = getConfigPda(mint);
    const [pda2] = getConfigPda(mint2);
    assert.notEqual(pda1.toBase58(), pda2.toBase58());
  });
});
