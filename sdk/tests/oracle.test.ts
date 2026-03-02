import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import { getOracleFeedPda, SSS_ORACLE_PROGRAM_ID } from "../src/pda";
import { encodePair, decodePair } from "../src/oracle";
import { FeedType } from "../src/types";

describe("Oracle SDK Unit Tests", () => {
  describe("encodePair / decodePair", () => {
    it("encodes a short pair correctly", () => {
      const buf = encodePair("EUR/USD");
      expect(buf.length).to.equal(12);
      expect(buf.toString("utf8", 0, 7)).to.equal("EUR/USD");
      // Remaining bytes should be zero-padded
      for (let i = 7; i < 12; i++) {
        expect(buf[i]).to.equal(0);
      }
    });

    it("decodes a pair with trailing zeroes", () => {
      const buf = Buffer.alloc(12, 0);
      buf.write("BRL/USD", "utf8");
      const result = decodePair(Array.from(buf));
      expect(result).to.equal("BRL/USD");
    });

    it("round-trips encode/decode", () => {
      const pairs = ["EUR/USD", "BRL/USD", "CPI", "A", "ABCDEFGHIJKL"];
      for (const p of pairs) {
        expect(decodePair(Array.from(encodePair(p)))).to.equal(p);
      }
    });

    it("handles max-length pair (12 chars)", () => {
      const maxPair = "ABCDEFGHIJKL";
      const buf = encodePair(maxPair);
      expect(buf.length).to.equal(12);
      expect(decodePair(Array.from(buf))).to.equal(maxPair);
    });
  });

  describe("getOracleFeedPda", () => {
    it("derives deterministic PDA for same inputs", () => {
      const config = PublicKey.unique();
      const pair = encodePair("EUR/USD");
      const [pda1] = getOracleFeedPda(config, pair);
      const [pda2] = getOracleFeedPda(config, pair);
      expect(pda1.toBase58()).to.equal(pda2.toBase58());
    });

    it("derives different PDAs for different pairs", () => {
      const config = PublicKey.unique();
      const [pda1] = getOracleFeedPda(config, encodePair("EUR/USD"));
      const [pda2] = getOracleFeedPda(config, encodePair("BRL/USD"));
      expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
    });

    it("derives different PDAs for different configs", () => {
      const config1 = PublicKey.unique();
      const config2 = PublicKey.unique();
      const pair = encodePair("EUR/USD");
      const [pda1] = getOracleFeedPda(config1, pair);
      const [pda2] = getOracleFeedPda(config2, pair);
      expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
    });

    it("uses SSS_ORACLE_PROGRAM_ID", () => {
      expect(SSS_ORACLE_PROGRAM_ID.toBase58()).to.equal(
        "ADuTfewteACQzaBpxB2ShicPZVgzW21XMA64Y84pg92k"
      );
    });
  });

  describe("FeedType constants", () => {
    it("defines Switchboard as 0 and Manual as 1", () => {
      expect(FeedType.Switchboard).to.equal(0);
      expect(FeedType.Manual).to.equal(1);
    });
  });
});
