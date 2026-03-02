# Oracle Integration Module

## Overview

The `sss-oracle` program is a standalone Anchor program that provides price feed integration for non-USD pegged stablecoins built with SSS. It supports two feed types:

- **Switchboard On-Demand** (type 0) — decentralized oracle feeds for live FX rates (EUR/USD, BRL/USD, etc.)
- **Manual / CPI-indexed** (type 1) — authority-pushed prices for CPI-indexed or algorithmic pegs

The module is fully independent — zero modifications to `sss-token` or `transfer-hook`. It reads the `StablecoinConfig` authority via raw byte parsing (same pattern as the transfer hook).

## Architecture

```
┌──────────────┐     reads authority     ┌──────────────────┐
│  sss-oracle  │ ◄───────────────────── │  sss-token       │
│  program     │     (raw bytes)         │  StablecoinConfig│
└──────┬───────┘                         └──────────────────┘
       │
       │  OracleFeedConfig PDA
       │  ["oracle-feed", config, pair]
       │
       ├── Switchboard On-Demand ──► reads PullFeedAccountData
       │                              (bytemuck manual parse)
       │
       └── Manual/CPI ──► authority pushes price directly
```

**Program ID:** `ADuTfewteACQzaBpxB2ShicPZVgzW21XMA64Y84pg92k`

## Supported Pairs

Any string up to 12 bytes. Examples:

| Pair | Use Case |
|------|----------|
| `EUR/USD` | Euro-pegged stablecoin |
| `BRL/USD` | Brazilian Real-pegged |
| `GBP/USD` | British Pound-pegged |
| `CPI` | CPI-indexed token (manual feed) |

Multiple feeds per stablecoin config are supported (one PDA per pair).

## State Account: OracleFeedConfig

PDA seeds: `["oracle-feed", config_pda, pair_bytes]`

| Field | Type | Description |
|-------|------|-------------|
| config | Pubkey | Associated StablecoinConfig PDA |
| authority | Pubkey | Copied from config at init |
| feed_account | Pubkey | Switchboard feed account (or default for manual) |
| switchboard_program | Pubkey | Switchboard program ID (cluster-specific) |
| pair | [u8; 12] | Currency pair identifier, zero-padded |
| max_staleness | u32 | Maximum staleness in slots (Switchboard) |
| min_samples | u8 | Minimum oracle samples required |
| max_confidence | u64 | Maximum std dev allowed (price units) |
| price_decimals | u8 | Decimal places for cached price |
| enabled | bool | Whether feed is active |
| feed_type | u8 | 0 = Switchboard, 1 = Manual |
| last_cached_price | u64 | Cached price (scaled by 10^price_decimals) |
| last_cached_slot | u64 | Slot of last cache |
| last_cached_ts | i64 | Timestamp of last cache |
| bump | u8 | PDA bump |
| _reserved | [u8; 64] | Reserved for upgrades |

Total size: 253 bytes (including 8-byte discriminator).

## Instructions

### `initialize_feed(params)`

Creates a new oracle feed config PDA. Caller must be the stablecoin authority.

**Params:** `pair: [u8;12]`, `feed_account: Pubkey`, `feed_type: u8`, `max_staleness: u32`, `min_samples: u8`, `max_confidence: u64`, `price_decimals: u8`, `switchboard_program: Pubkey`

**Validations:** pair non-empty, feed_type in {0,1}, price_decimals <= 18, signer = config authority. The `switchboard_program` is stored in the feed config and validated at `cache_price` time (ignored for manual feeds).

### `update_feed_config(params)`

Updates feed parameters. All fields are optional.

**Params:** `max_staleness: Option<u32>`, `min_samples: Option<u8>`, `max_confidence: Option<u64>`, `price_decimals: Option<u8>`, `enabled: Option<bool>`, `feed_account: Option<Pubkey>`

### `cache_price()`

Permissionless. Reads Switchboard PullFeedAccountData, validates staleness/confidence/samples, and caches the result. Only works for feed_type 0.

**Validations:** feed enabled, feed_type == 0, feed_account key matches, feed_account owner == stored switchboard_program, staleness <= max_staleness, std_dev <= max_confidence, num_samples >= min_samples.

### `set_manual_price(price: u64)`

Authority-only. Sets the cached price for manual/CPI-indexed feeds. Only works for feed_type 1.

**Validations:** price > 0, feed_type == 1, signer = authority.

### `close_feed()`

Authority-only. Closes the feed PDA, zeros all data, and reclaims rent.

## Events

| Event | Fields |
|-------|--------|
| FeedInitializedEvent | config, authority, feed_pda, pair, feed_type, timestamp |
| FeedConfigUpdatedEvent | feed_pda, authority, field_changed, timestamp |
| PriceCachedEvent | feed_pda, pair, price, slot, timestamp |
| ManualPriceSetEvent | feed_pda, authority, price, timestamp |
| FeedClosedEvent | feed_pda, authority, pair, timestamp |

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | InvalidAuthority | Caller is not the stablecoin authority |
| 6001 | InvalidConfigAccount | Wrong owner or discriminator on config |
| 6002 | InvalidPair | Pair bytes are all zero |
| 6003 | InvalidFeedType | feed_type not 0 or 1 |
| 6004 | InvalidDecimals | price_decimals > 18 |
| 6005 | FeedDisabled | Feed is not enabled |
| 6006 | FeedAccountMismatch | Passed feed != stored feed_account |
| 6007 | InvalidFeedOwner | Feed not owned by Switchboard |
| 6008 | InvalidSwitchboardData | Feed data invalid or too short |
| 6009 | StalePrice | Exceeds max_staleness slots |
| 6010 | ExcessiveConfidence | Std dev exceeds max_confidence |
| 6011 | InvalidPrice | Price is zero or negative |
| 6012 | Overflow | Arithmetic overflow in conversion |

## Security Model

1. **Authority validation** — raw byte parsing of StablecoinConfig (discriminator + owner check), same fail-closed pattern as transfer-hook
2. **Staleness protection** — max_staleness limits how old a Switchboard price can be
3. **Confidence bounds** — max_confidence rejects high-variance oracle responses
4. **Sample minimums** — min_samples ensures adequate oracle consensus
5. **Owner verification** — feed_account must be owned by the stored switchboard_program (cluster-agnostic: mainnet `SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv`, devnet `Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2`)
6. **Key binding** — feed_account key must match the stored value (prevents substitution)
7. **Data zeroing** — close_feed zeros all account data before reclaiming rent

## SDK API Reference

### OracleModule

Accessed via `stablecoin.oracle` on a `SolanaStablecoin` instance.

```typescript
// Initialize a Switchboard feed
await stablecoin.oracle.initializeFeed({
  pair: "EUR/USD",
  feedAccount: switchboardFeedPubkey,
  feedType: FeedType.Switchboard,
  maxStaleness: 100,
  minSamples: 1,
  maxConfidence: new BN(100_000),
  priceDecimals: 6,
  switchboardProgram: new PublicKey("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv"), // mainnet
});

// Update feed parameters
await stablecoin.oracle.updateFeedConfig("EUR/USD", {
  maxStaleness: 200,
  enabled: false,
});

// Cache price from Switchboard (permissionless)
await stablecoin.oracle.cachePrice("EUR/USD", switchboardFeedPubkey);

// Set manual price (authority only)
await stablecoin.oracle.setManualPrice("CPI", new BN(102_500_000));

// Query feed config
const feed = await stablecoin.oracle.getFeedConfig("EUR/USD");

// Get cached price
const price = await stablecoin.oracle.getCachedPrice("EUR/USD");

// List all feeds for this stablecoin
const feeds = await stablecoin.oracle.getAllFeeds();

// Close a feed
await stablecoin.oracle.closeFeed("EUR/USD");
```

### Standalone Helpers

```typescript
import { encodePair, decodePair, getOracleFeedPda, SSS_ORACLE_PROGRAM_ID } from "@stbr/sss-token";

const pair = encodePair("EUR/USD"); // Buffer(12)
const str = decodePair(pair);       // "EUR/USD"
const [pda] = getOracleFeedPda(configPda, pair);
```

## Example: EUR-Pegged Stablecoin with Live FX Rate

```typescript
import { SolanaStablecoin, FeedType } from "@stbr/sss-token";
import { BN } from "@coral-xyz/anchor";

// 1. Create the stablecoin
const stable = await SolanaStablecoin.create(connection, {
  name: "Euro Stablecoin",
  symbol: "EURS",
  decimals: 6,
  authority: adminKeypair,
});

// 2. Create a Switchboard feed on devnet/mainnet for EUR/USD
//    (use Switchboard's on-demand builder to create the feed)
const switchboardFeedPubkey = new PublicKey("...");

// 3. Initialize the oracle feed
await stable.oracle.initializeFeed({
  pair: "EUR/USD",
  feedAccount: switchboardFeedPubkey,
  feedType: FeedType.Switchboard,
  maxStaleness: 100, // ~40 seconds at 400ms slots
  minSamples: 1,
  maxConfidence: new BN(10_000), // 0.01 with 6 decimals
  priceDecimals: 6,
  switchboardProgram: new PublicKey("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2"), // devnet
});

// 4. Anyone can cache the price (permissionless cranking)
await stable.oracle.cachePrice("EUR/USD", switchboardFeedPubkey);

// 5. Read the cached price
const price = await stable.oracle.getCachedPrice("EUR/USD");
if (price) {
  console.log(`EUR/USD: ${price.price.toNumber() / 10 ** price.decimals}`);
}
```

## Creating Switchboard Feeds

Use the [Switchboard On-Demand](https://docs.switchboard.xyz/) builder to create a pull feed for your desired pair. The feed account must be created separately on Switchboard before initializing the oracle feed config in SSS.

For client-side price refresh, use Switchboard's `pullIx` to update the feed data before calling `cache_price`:

```typescript
import { PullFeed } from "@switchboard-xyz/on-demand";

const [pullIx] = await PullFeed.fetchUpdateIx(connection, {
  feed: switchboardFeedPubkey,
  numSignatures: 3,
});

const cacheIx = await oracleProgram.methods
  .cachePrice()
  .accounts({ feedAccount: switchboardFeedPubkey, oracleFeed: feedPda })
  .instruction();

// Bundle both in one transaction
const tx = new Transaction().add(pullIx, cacheIx);
await sendAndConfirmTransaction(connection, tx, [payer]);
```

## Switchboard Data Parsing

The program parses Switchboard `PullFeedAccountData` manually via raw byte reading (not the Switchboard crate) to avoid transitive dependency issues with the SBF toolchain.

**Layout:** The `CurrentResult` struct lives at offset 2256 from the account start (after 8-byte discriminator + 2248 bytes of submissions array and other fields). All values use 18-decimal fixed-point representation.

| Offset (from CurrentResult) | Type | Field |
|-----|------|-------|
| 0 | i128 | value (median price, 18 decimals) |
| 16 | i128 | std_dev (standard deviation, 18 decimals) |
| 96 | u8 | num_samples |
| 104 | u64 | slot |

**Discriminator:** `[196, 27, 108, 196, 10, 215, 219, 40]` — first 8 bytes of `sha256("account:PullFeedAccountData")`.

**Conversion formula:** `cached_price = value / 10^(18 - price_decimals)`

For example, with `price_decimals = 6` and a raw value of `1_080_000_000_000_000_000` (1.08 EUR/USD at 18 decimals), the cached price becomes `1_080_000` (1.08 at 6 decimals).

**Cluster-agnostic design:** The Switchboard program ID is stored per-feed at initialization time, not hardcoded. This allows the same program binary to work on both mainnet (`SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv`) and devnet (`Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2`).
