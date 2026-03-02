import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { SssToken } from "../target/types/sss_token";
import { SssOracle } from "../target/types/sss_oracle";
import {
  airdropSol,
  createStablecoin,
  assertError,
  SSS_TOKEN_PROGRAM_ID,
  getOracleFeedPda,
} from "./helpers";

function encodePair(s: string): number[] {
  const buf = Buffer.alloc(12, 0);
  buf.write(s, "utf8");
  return Array.from(buf);
}

function decodePair(bytes: number[] | Uint8Array): string {
  return Buffer.from(bytes)
    .toString("utf8")
    .replace(/\0+$/, "");
}

// Switchboard On-Demand program IDs
const SWITCHBOARD_MAINNET = new PublicKey(
  "SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv"
);

// Mock Switchboard feed account pre-loaded via Anchor.toml [[test.validator.account]]
// Data: discriminator + PullFeedAccountData with value=1.085*10^18, std_dev=0.0005*10^18,
// num_samples=5, slot=u64::MAX. Owner = SWITCHBOARD_MAINNET.
const MOCK_SWITCHBOARD_FEED = new PublicKey(
  "13Dqg5ktj6Aj9tBVYCGh8eRd9sTnFYx9cCRVyvXBwJEb"
);

describe("sss-oracle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SssToken as Program<SssToken>;
  const oracleProgram = anchor.workspace.SssOracle as Program<SssOracle>;
  const authority = provider.wallet.payer;

  let configPda: PublicKey;
  let mint: Keypair;

  const eurPair = encodePair("EUR/USD");
  const brlPair = encodePair("BRL/USD");
  const cpiPair = encodePair("CPI");

  // Fake feed account for Switchboard (we can't construct real Switchboard data in LiteSVM)
  const fakeFeedAccount = Keypair.generate();

  before(async () => {
    await airdropSol(provider.connection, authority.publicKey, 100);

    const result = await createStablecoin(program, null, authority, {
      name: "Euro Stablecoin",
      symbol: "EURS",
      decimals: 6,
    });
    configPda = result.configPda;
    mint = result.mint;
  });

  // ==================== initialize_feed ====================

  describe("initialize_feed", () => {
    it("creates a Switchboard feed config (EUR/USD)", async () => {
      const [oracleFeedPda] = getOracleFeedPda(configPda, eurPair);

      await oracleProgram.methods
        .initializeFeed({
          pair: eurPair,
          feedAccount: fakeFeedAccount.publicKey,
          feedType: 0,
          maxStaleness: 100,
          minSamples: 1,
          maxConfidence: new anchor.BN(100_000),
          priceDecimals: 6,
          switchboardProgram: SWITCHBOARD_MAINNET,
        })
        .accounts({
          authority: authority.publicKey,
          config: configPda,
          oracleFeed: oracleFeedPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();

      const feed = await oracleProgram.account.oracleFeedConfig.fetch(
        oracleFeedPda
      );
      expect(feed.config.toBase58()).to.equal(configPda.toBase58());
      expect(feed.authority.toBase58()).to.equal(
        authority.publicKey.toBase58()
      );
      expect(feed.feedAccount.toBase58()).to.equal(
        fakeFeedAccount.publicKey.toBase58()
      );
      expect(feed.switchboardProgram.toBase58()).to.equal(
        SWITCHBOARD_MAINNET.toBase58()
      );
      expect(decodePair(feed.pair)).to.equal("EUR/USD");
      expect(feed.maxStaleness).to.equal(100);
      expect(feed.minSamples).to.equal(1);
      expect(feed.maxConfidence.toNumber()).to.equal(100_000);
      expect(feed.priceDecimals).to.equal(6);
      expect(feed.enabled).to.be.true;
      expect(feed.feedType).to.equal(0);
      expect(feed.lastCachedPrice.toNumber()).to.equal(0);
      expect(feed.lastCachedSlot.toNumber()).to.equal(0);
      expect(feed.lastCachedTs.toNumber()).to.equal(0);
    });

    it("creates a manual feed config (CPI-indexed)", async () => {
      const [oracleFeedPda] = getOracleFeedPda(configPda, cpiPair);

      await oracleProgram.methods
        .initializeFeed({
          pair: cpiPair,
          feedAccount: PublicKey.default,
          feedType: 1,
          maxStaleness: 0,
          minSamples: 0,
          maxConfidence: new anchor.BN(0),
          priceDecimals: 8,
          switchboardProgram: PublicKey.default,
        })
        .accounts({
          authority: authority.publicKey,
          config: configPda,
          oracleFeed: oracleFeedPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();

      const feed = await oracleProgram.account.oracleFeedConfig.fetch(
        oracleFeedPda
      );
      expect(decodePair(feed.pair)).to.equal("CPI");
      expect(feed.feedType).to.equal(1);
      expect(feed.priceDecimals).to.equal(8);
    });

    it("creates multiple feeds for the same config (BRL/USD)", async () => {
      const [oracleFeedPda] = getOracleFeedPda(configPda, brlPair);

      await oracleProgram.methods
        .initializeFeed({
          pair: brlPair,
          feedAccount: fakeFeedAccount.publicKey,
          feedType: 0,
          maxStaleness: 50,
          minSamples: 3,
          maxConfidence: new anchor.BN(50_000),
          priceDecimals: 6,
          switchboardProgram: SWITCHBOARD_MAINNET,
        })
        .accounts({
          authority: authority.publicKey,
          config: configPda,
          oracleFeed: oracleFeedPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();

      const feed = await oracleProgram.account.oracleFeedConfig.fetch(
        oracleFeedPda
      );
      expect(decodePair(feed.pair)).to.equal("BRL/USD");
      expect(feed.minSamples).to.equal(3);
    });

    it("rejects non-authority signer", async () => {
      const rando = Keypair.generate();
      await airdropSol(provider.connection, rando.publicKey, 5);
      const testPair = encodePair("GBP/USD");
      const [oracleFeedPda] = getOracleFeedPda(configPda, testPair);

      await assertError(
        () =>
          oracleProgram.methods
            .initializeFeed({
              pair: testPair,
              feedAccount: PublicKey.default,
              feedType: 0,
              maxStaleness: 100,
              minSamples: 1,
              maxConfidence: new anchor.BN(0),
              priceDecimals: 6,
              switchboardProgram: SWITCHBOARD_MAINNET,
            })
            .accounts({
              authority: rando.publicKey,
              config: configPda,
              oracleFeed: oracleFeedPda,
              systemProgram: SystemProgram.programId,
            } as any)
            .signers([rando])
            .rpc(),
        "InvalidAuthority"
      );
    });

    it("rejects all-zero pair", async () => {
      const zeroPair = new Array(12).fill(0);
      const [oracleFeedPda] = getOracleFeedPda(configPda, zeroPair);

      await assertError(
        () =>
          oracleProgram.methods
            .initializeFeed({
              pair: zeroPair,
              feedAccount: PublicKey.default,
              feedType: 0,
              maxStaleness: 100,
              minSamples: 1,
              maxConfidence: new anchor.BN(0),
              priceDecimals: 6,
              switchboardProgram: SWITCHBOARD_MAINNET,
            })
            .accounts({
              authority: authority.publicKey,
              config: configPda,
              oracleFeed: oracleFeedPda,
              systemProgram: SystemProgram.programId,
            } as any)
            .signers([authority])
            .rpc(),
        "InvalidPair"
      );
    });

    it("rejects invalid feed_type", async () => {
      const testPair = encodePair("JPY/USD");
      const [oracleFeedPda] = getOracleFeedPda(configPda, testPair);

      await assertError(
        () =>
          oracleProgram.methods
            .initializeFeed({
              pair: testPair,
              feedAccount: PublicKey.default,
              feedType: 2,
              maxStaleness: 100,
              minSamples: 1,
              maxConfidence: new anchor.BN(0),
              priceDecimals: 6,
              switchboardProgram: SWITCHBOARD_MAINNET,
            })
            .accounts({
              authority: authority.publicKey,
              config: configPda,
              oracleFeed: oracleFeedPda,
              systemProgram: SystemProgram.programId,
            } as any)
            .signers([authority])
            .rpc(),
        "InvalidFeedType"
      );
    });

    it("rejects price_decimals > 18", async () => {
      const testPair = encodePair("CHF/USD");
      const [oracleFeedPda] = getOracleFeedPda(configPda, testPair);

      await assertError(
        () =>
          oracleProgram.methods
            .initializeFeed({
              pair: testPair,
              feedAccount: PublicKey.default,
              feedType: 0,
              maxStaleness: 100,
              minSamples: 1,
              maxConfidence: new anchor.BN(0),
              priceDecimals: 19,
              switchboardProgram: SWITCHBOARD_MAINNET,
            })
            .accounts({
              authority: authority.publicKey,
              config: configPda,
              oracleFeed: oracleFeedPda,
              systemProgram: SystemProgram.programId,
            } as any)
            .signers([authority])
            .rpc(),
        "InvalidDecimals"
      );
    });

    it("rejects duplicate init (same pair)", async () => {
      const [oracleFeedPda] = getOracleFeedPda(configPda, eurPair);

      await assertError(() =>
        oracleProgram.methods
          .initializeFeed({
            pair: eurPair,
            feedAccount: fakeFeedAccount.publicKey,
            feedType: 0,
            maxStaleness: 100,
            minSamples: 1,
            maxConfidence: new anchor.BN(100_000),
            priceDecimals: 6,
            switchboardProgram: SWITCHBOARD_MAINNET,
          })
          .accounts({
            authority: authority.publicKey,
            config: configPda,
            oracleFeed: oracleFeedPda,
            systemProgram: SystemProgram.programId,
          } as any)
          .signers([authority])
          .rpc()
      );
    });
  });

  // ==================== update_feed_config ====================

  describe("update_feed_config", () => {
    it("updates max_staleness and enabled flag", async () => {
      const [oracleFeedPda] = getOracleFeedPda(configPda, eurPair);

      await oracleProgram.methods
        .updateFeedConfig({
          maxStaleness: 200,
          minSamples: null,
          maxConfidence: null,
          priceDecimals: null,
          enabled: false,
          feedAccount: null,
        })
        .accounts({
          authority: authority.publicKey,
          oracleFeed: oracleFeedPda,
        } as any)
        .signers([authority])
        .rpc();

      const feed = await oracleProgram.account.oracleFeedConfig.fetch(
        oracleFeedPda
      );
      expect(feed.maxStaleness).to.equal(200);
      expect(feed.enabled).to.be.false;

      // Re-enable for later tests
      await oracleProgram.methods
        .updateFeedConfig({
          maxStaleness: null,
          minSamples: null,
          maxConfidence: null,
          priceDecimals: null,
          enabled: true,
          feedAccount: null,
        })
        .accounts({
          authority: authority.publicKey,
          oracleFeed: oracleFeedPda,
        } as any)
        .signers([authority])
        .rpc();
    });

    it("rejects non-authority", async () => {
      const rando = Keypair.generate();
      await airdropSol(provider.connection, rando.publicKey, 5);
      const [oracleFeedPda] = getOracleFeedPda(configPda, eurPair);

      await assertError(
        () =>
          oracleProgram.methods
            .updateFeedConfig({
              maxStaleness: 999,
              minSamples: null,
              maxConfidence: null,
              priceDecimals: null,
              enabled: null,
              feedAccount: null,
            })
            .accounts({
              authority: rando.publicKey,
              oracleFeed: oracleFeedPda,
            } as any)
            .signers([rando])
            .rpc(),
        "InvalidAuthority"
      );
    });
  });

  // ==================== set_manual_price ====================

  describe("set_manual_price", () => {
    it("sets price on manual feed", async () => {
      const [oracleFeedPda] = getOracleFeedPda(configPda, cpiPair);
      const price = new anchor.BN(102_500_000); // 1.025 with 8 decimals

      await oracleProgram.methods
        .setManualPrice(price)
        .accounts({
          authority: authority.publicKey,
          oracleFeed: oracleFeedPda,
        } as any)
        .signers([authority])
        .rpc();

      const feed = await oracleProgram.account.oracleFeedConfig.fetch(
        oracleFeedPda
      );
      expect(feed.lastCachedPrice.toNumber()).to.equal(102_500_000);
      expect(feed.lastCachedSlot.toNumber()).to.be.greaterThan(0);
      expect(feed.lastCachedTs.toNumber()).to.be.greaterThan(0);
    });

    it("updates cached fields correctly on second set", async () => {
      const [oracleFeedPda] = getOracleFeedPda(configPda, cpiPair);
      const price2 = new anchor.BN(103_000_000);

      const feedBefore = await oracleProgram.account.oracleFeedConfig.fetch(
        oracleFeedPda
      );

      await oracleProgram.methods
        .setManualPrice(price2)
        .accounts({
          authority: authority.publicKey,
          oracleFeed: oracleFeedPda,
        } as any)
        .signers([authority])
        .rpc();

      const feedAfter = await oracleProgram.account.oracleFeedConfig.fetch(
        oracleFeedPda
      );
      expect(feedAfter.lastCachedPrice.toNumber()).to.equal(103_000_000);
      expect(feedAfter.lastCachedSlot.toNumber()).to.be.greaterThanOrEqual(
        feedBefore.lastCachedSlot.toNumber()
      );
    });

    it("rejects zero price", async () => {
      const [oracleFeedPda] = getOracleFeedPda(configPda, cpiPair);

      await assertError(
        () =>
          oracleProgram.methods
            .setManualPrice(new anchor.BN(0))
            .accounts({
              authority: authority.publicKey,
              oracleFeed: oracleFeedPda,
            } as any)
            .signers([authority])
            .rpc(),
        "InvalidPrice"
      );
    });

    it("rejects non-authority", async () => {
      const rando = Keypair.generate();
      await airdropSol(provider.connection, rando.publicKey, 5);
      const [oracleFeedPda] = getOracleFeedPda(configPda, cpiPair);

      await assertError(
        () =>
          oracleProgram.methods
            .setManualPrice(new anchor.BN(100_000_000))
            .accounts({
              authority: rando.publicKey,
              oracleFeed: oracleFeedPda,
            } as any)
            .signers([rando])
            .rpc(),
        "InvalidAuthority"
      );
    });

    it("rejects set_manual_price on Switchboard feed", async () => {
      const [oracleFeedPda] = getOracleFeedPda(configPda, eurPair);

      await assertError(
        () =>
          oracleProgram.methods
            .setManualPrice(new anchor.BN(1_080_000))
            .accounts({
              authority: authority.publicKey,
              oracleFeed: oracleFeedPda,
            } as any)
            .signers([authority])
            .rpc(),
        "InvalidFeedType"
      );
    });
  });

  // ==================== cache_price ====================

  describe("cache_price", () => {
    const audPair = encodePair("AUD/USD");

    it("caches price from mock Switchboard feed", async () => {
      // Create a Switchboard feed pointing at the pre-loaded mock account
      const [audFeedPda] = getOracleFeedPda(configPda, audPair);

      await oracleProgram.methods
        .initializeFeed({
          pair: audPair,
          feedAccount: MOCK_SWITCHBOARD_FEED,
          feedType: 0,
          maxStaleness: 4_294_967_295, // u32::MAX — mock slot is u64::MAX so any staleness passes
          minSamples: 1,
          maxConfidence: new anchor.BN(100_000),
          priceDecimals: 6,
          switchboardProgram: SWITCHBOARD_MAINNET,
        })
        .accounts({
          authority: authority.publicKey,
          config: configPda,
          oracleFeed: audFeedPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();

      // Cache the price — permissionless, no signer needed
      await oracleProgram.methods
        .cachePrice()
        .accounts({
          feedAccount: MOCK_SWITCHBOARD_FEED,
          oracleFeed: audFeedPda,
        } as any)
        .rpc();

      // Verify cached price: 1.085 * 10^18 / 10^(18-6) = 1_085_000
      const feed = await oracleProgram.account.oracleFeedConfig.fetch(audFeedPda);
      expect(feed.lastCachedPrice.toNumber()).to.equal(1_085_000);
      expect(feed.lastCachedSlot.toNumber()).to.be.greaterThan(0);
      expect(feed.lastCachedTs.toNumber()).to.be.greaterThan(0);
      expect(decodePair(feed.pair)).to.equal("AUD/USD");
    });

    it("caches correct price with different decimals", async () => {
      // Create another feed with 8 price_decimals to verify decimal conversion
      const gbpPair = encodePair("GBP/USD");
      const [gbpFeedPda] = getOracleFeedPda(configPda, gbpPair);

      await oracleProgram.methods
        .initializeFeed({
          pair: gbpPair,
          feedAccount: MOCK_SWITCHBOARD_FEED,
          feedType: 0,
          maxStaleness: 4_294_967_295,
          minSamples: 1,
          maxConfidence: new anchor.BN(100_000_000), // scaled for 8 decimals
          priceDecimals: 8,
          switchboardProgram: SWITCHBOARD_MAINNET,
        })
        .accounts({
          authority: authority.publicKey,
          config: configPda,
          oracleFeed: gbpFeedPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();

      await oracleProgram.methods
        .cachePrice()
        .accounts({
          feedAccount: MOCK_SWITCHBOARD_FEED,
          oracleFeed: gbpFeedPda,
        } as any)
        .rpc();

      // 1.085 * 10^18 / 10^(18-8) = 108_500_000
      const feed = await oracleProgram.account.oracleFeedConfig.fetch(gbpFeedPda);
      expect(feed.lastCachedPrice.toNumber()).to.equal(108_500_000);
    });

    it("rejects when confidence exceeds max_confidence", async () => {
      // Create feed with very tight max_confidence that the mock std_dev will exceed
      // Mock std_dev = 500_000_000_000_000 (0.0005 * 10^18)
      // With price_decimals=6: confidence = 500_000_000_000_000 / 10^12 = 500
      // Set max_confidence = 100 < 500 → should fail
      const tightPair = encodePair("TIGHT");
      const [tightFeedPda] = getOracleFeedPda(configPda, tightPair);

      await oracleProgram.methods
        .initializeFeed({
          pair: tightPair,
          feedAccount: MOCK_SWITCHBOARD_FEED,
          feedType: 0,
          maxStaleness: 4_294_967_295,
          minSamples: 1,
          maxConfidence: new anchor.BN(100), // tighter than mock's std_dev of 500
          priceDecimals: 6,
          switchboardProgram: SWITCHBOARD_MAINNET,
        })
        .accounts({
          authority: authority.publicKey,
          config: configPda,
          oracleFeed: tightFeedPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();

      await assertError(
        () =>
          oracleProgram.methods
            .cachePrice()
            .accounts({
              feedAccount: MOCK_SWITCHBOARD_FEED,
              oracleFeed: tightFeedPda,
            } as any)
            .rpc(),
        "ExcessiveConfidence"
      );
    });

    it("rejects when num_samples below min_samples", async () => {
      // Mock has num_samples=5, set min_samples=10 → should fail
      const samplePair = encodePair("SAMP");
      const [sampleFeedPda] = getOracleFeedPda(configPda, samplePair);

      await oracleProgram.methods
        .initializeFeed({
          pair: samplePair,
          feedAccount: MOCK_SWITCHBOARD_FEED,
          feedType: 0,
          maxStaleness: 4_294_967_295,
          minSamples: 10, // mock only has 5
          maxConfidence: new anchor.BN(100_000),
          priceDecimals: 6,
          switchboardProgram: SWITCHBOARD_MAINNET,
        })
        .accounts({
          authority: authority.publicKey,
          config: configPda,
          oracleFeed: sampleFeedPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();

      await assertError(
        () =>
          oracleProgram.methods
            .cachePrice()
            .accounts({
              feedAccount: MOCK_SWITCHBOARD_FEED,
              oracleFeed: sampleFeedPda,
            } as any)
            .rpc(),
        "InvalidSwitchboardData"
      );
    });

    it("rejects feed key mismatch", async () => {
      const wrongFeed = Keypair.generate();
      const [oracleFeedPda] = getOracleFeedPda(configPda, eurPair);

      await assertError(
        () =>
          oracleProgram.methods
            .cachePrice()
            .accounts({
              feedAccount: wrongFeed.publicKey,
              oracleFeed: oracleFeedPda,
            } as any)
            .rpc(),
        "FeedAccountMismatch"
      );
    });

    it("rejects wrong owner (not Switchboard)", async () => {
      const [oracleFeedPda] = getOracleFeedPda(configPda, eurPair);

      // fakeFeedAccount is a system account, not owned by Switchboard
      await assertError(
        () =>
          oracleProgram.methods
            .cachePrice()
            .accounts({
              feedAccount: fakeFeedAccount.publicKey,
              oracleFeed: oracleFeedPda,
            } as any)
            .rpc(),
        "InvalidFeedOwner"
      );
    });

    it("rejects disabled feed", async () => {
      const [oracleFeedPda] = getOracleFeedPda(configPda, eurPair);

      // Disable the feed first
      await oracleProgram.methods
        .updateFeedConfig({
          maxStaleness: null,
          minSamples: null,
          maxConfidence: null,
          priceDecimals: null,
          enabled: false,
          feedAccount: null,
        })
        .accounts({
          authority: authority.publicKey,
          oracleFeed: oracleFeedPda,
        } as any)
        .signers([authority])
        .rpc();

      await assertError(
        () =>
          oracleProgram.methods
            .cachePrice()
            .accounts({
              feedAccount: fakeFeedAccount.publicKey,
              oracleFeed: oracleFeedPda,
            } as any)
            .rpc(),
        "FeedDisabled"
      );

      // Re-enable
      await oracleProgram.methods
        .updateFeedConfig({
          maxStaleness: null,
          minSamples: null,
          maxConfidence: null,
          priceDecimals: null,
          enabled: true,
          feedAccount: null,
        })
        .accounts({
          authority: authority.publicKey,
          oracleFeed: oracleFeedPda,
        } as any)
        .signers([authority])
        .rpc();
    });

    it("rejects cache_price on manual feed", async () => {
      const [oracleFeedPda] = getOracleFeedPda(configPda, cpiPair);

      await assertError(
        () =>
          oracleProgram.methods
            .cachePrice()
            .accounts({
              feedAccount: fakeFeedAccount.publicKey,
              oracleFeed: oracleFeedPda,
            } as any)
            .rpc(),
        "InvalidFeedType"
      );
    });
  });

  // ==================== close_feed ====================

  describe("close_feed", () => {
    it("closes a feed and reclaims rent", async () => {
      const [brlFeedPda] = getOracleFeedPda(configPda, brlPair);

      const balBefore = await provider.connection.getBalance(
        authority.publicKey
      );

      await oracleProgram.methods
        .closeFeed()
        .accounts({
          authority: authority.publicKey,
          oracleFeed: brlFeedPda,
        } as any)
        .signers([authority])
        .rpc();

      const balAfter = await provider.connection.getBalance(
        authority.publicKey
      );
      expect(balAfter).to.be.greaterThan(balBefore);

      // Account should be gone
      const acct = await provider.connection.getAccountInfo(brlFeedPda);
      expect(acct).to.be.null;
    });

    it("zeroes data after close", async () => {
      // Create a new feed to close
      const tempPair = encodePair("TMP");
      const [tempFeedPda] = getOracleFeedPda(configPda, tempPair);

      await oracleProgram.methods
        .initializeFeed({
          pair: tempPair,
          feedAccount: PublicKey.default,
          feedType: 1,
          maxStaleness: 0,
          minSamples: 0,
          maxConfidence: new anchor.BN(0),
          priceDecimals: 6,
          switchboardProgram: PublicKey.default,
        })
        .accounts({
          authority: authority.publicKey,
          config: configPda,
          oracleFeed: tempFeedPda,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();

      await oracleProgram.methods
        .closeFeed()
        .accounts({
          authority: authority.publicKey,
          oracleFeed: tempFeedPda,
        } as any)
        .signers([authority])
        .rpc();

      // In LiteSVM, closed account should return null
      const acct = await provider.connection.getAccountInfo(tempFeedPda);
      expect(acct).to.be.null;
    });

    it("rejects non-authority close", async () => {
      const rando = Keypair.generate();
      await airdropSol(provider.connection, rando.publicKey, 5);
      const [oracleFeedPda] = getOracleFeedPda(configPda, eurPair);

      await assertError(
        () =>
          oracleProgram.methods
            .closeFeed()
            .accounts({
              authority: rando.publicKey,
              oracleFeed: oracleFeedPda,
            } as any)
            .signers([rando])
            .rpc(),
        "InvalidAuthority"
      );
    });
  });
});
