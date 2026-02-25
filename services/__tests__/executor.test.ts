import { expect } from "chai";
import { Keypair } from "@solana/web3.js";
import { loadAuthorityKeypair } from "../mint-burn/src/executor";

describe("loadAuthorityKeypair", () => {
  const origKeypair = process.env.AUTHORITY_KEYPAIR;
  afterEach(() => {
    if (origKeypair !== undefined) {
      process.env.AUTHORITY_KEYPAIR = origKeypair;
    } else {
      delete process.env.AUTHORITY_KEYPAIR;
    }
  });

  it("loads valid 64-byte keypair from env", () => {
    const kp = Keypair.generate();
    process.env.AUTHORITY_KEYPAIR = JSON.stringify(Array.from(kp.secretKey));
    const loaded = loadAuthorityKeypair();
    expect(loaded.publicKey.toBase58()).to.equal(kp.publicKey.toBase58());
  });

  it("throws when AUTHORITY_KEYPAIR is not set", () => {
    delete process.env.AUTHORITY_KEYPAIR;
    expect(() => loadAuthorityKeypair()).to.throw("AUTHORITY_KEYPAIR env var required");
  });

  it("throws on invalid JSON without leaking key material", () => {
    process.env.AUTHORITY_KEYPAIR = "not-json{{{";
    expect(() => loadAuthorityKeypair()).to.throw("invalid JSON");
    // Verify the raw value is NOT in the error message
    try {
      loadAuthorityKeypair();
    } catch (e: any) {
      expect(e.message).to.not.include("not-json");
    }
  });

  it("throws on wrong array length", () => {
    process.env.AUTHORITY_KEYPAIR = JSON.stringify([1, 2, 3]);
    expect(() => loadAuthorityKeypair()).to.throw("64-byte array");
    expect(() => loadAuthorityKeypair()).to.throw("got 3 elements");
  });

  it("throws on non-array JSON", () => {
    process.env.AUTHORITY_KEYPAIR = JSON.stringify({ key: "value" });
    expect(() => loadAuthorityKeypair()).to.throw("64-byte array");
  });
});
