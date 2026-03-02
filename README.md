# Solana Stablecoin Standard (SSS)

An open-source SDK and standardized presets for stablecoins on Solana, built on Token-2022 extensions. Modeled after the [Vault Standard](https://github.com/solanabr/solana-vault-standard), SSS provides three Anchor programs, a TypeScript SDK, an admin CLI, Docker-containerized backend services, an interactive terminal UI, and a React dashboard — a complete infrastructure for issuing and managing stablecoins, from minimal DAO tokens to regulatory-grade assets.

## Program IDs (Devnet)

| Program | Description | ID |
|---------|-------------|-----|
| `sss_token` | Core stablecoin (both presets) | [`Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1`](https://explorer.solana.com/address/Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1?cluster=devnet) |
| `transfer_hook` | SSS-2 compliance enforcement | [`7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj`](https://explorer.solana.com/address/7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj?cluster=devnet) |
| `sss_oracle` | Oracle price feeds | [`ADuTfewteACQzaBpxB2ShicPZVgzW21XMA64Y84pg92k`](https://explorer.solana.com/address/ADuTfewteACQzaBpxB2ShicPZVgzW21XMA64Y84pg92k?cluster=devnet) |

### Example Transactions (Devnet)

| Operation | Signature |
|-----------|-----------|
| Mint 1000 SDUSD | [`2HGLkZ...5DKv`](https://explorer.solana.com/tx/2HGLkZFjYAznVGhbHUnuoaXV3H1pUgaw61Ut7xagmGByoSKZbYZdRPTB5KaAf2ZFVaSpNq2MTHJGJUEPAyZp5DKv?cluster=devnet) |
| Blacklist address | [`5Tjk4b...6sA4`](https://explorer.solana.com/tx/5Tjk4bJoj5Luakj3B9548Wz3waLaFoqXkNA61BvS9V8U9oANhwCfSqU9DfMQd9tLK57xF5oFAfp15QD58yWz6sA4?cluster=devnet) |
| Unblacklist address | [`G7FAtS...xUeL`](https://explorer.solana.com/tx/G7FAtSn9j2d2XCn7mPVqGxszcmZhjFTEo2f5Co8YPDqoDqWnK24yVrYjtrCvjkEckqq2XzzNbTYrhhC8xocxUeL?cluster=devnet) |

Demo mint: [`AHAZWMZuSRPA94qyEzN7H6BsrMwnTr3ZofeXsUZ6wUms`](https://explorer.solana.com/address/AHAZWMZuSRPA94qyEzN7H6BsrMwnTr3ZofeXsUZ6wUms?cluster=devnet)

---

## Architecture

```
                        ┌─────────────────────────────────────────────┐
 Layer 3 (Presets)      │  SSS-1 (Minimal)  │  SSS-2 (Compliant)     │
                        ├─────────────────────────────────────────────┤
 Layer 2 (Modules)      │  Compliance: transfer hooks, blacklists,   │
                        │              permanent delegate             │
                        │  Oracle: Switchboard On-Demand + manual     │
                        │          price feeds (non-USD pegs)         │
                        ├─────────────────────────────────────────────┤
 Layer 1 (Base SDK)     │  Token creation, mint/freeze authorities,   │
                        │  RBAC (6 roles), Token-2022 metadata        │
                        └─────────────────────────────────────────────┘
```

A single Anchor program (`sss_token`) supports both presets via `StablecoinConfig` flags. The transfer hook is a separate program registered at initialization. The oracle module is fully independent — zero modifications to `sss_token` or `transfer_hook`.

### Preset Comparison

| Feature | SSS-1 (Minimal) | SSS-2 (Compliant) |
|---------|:---:|:---:|
| Mint / Burn | Yes | Yes |
| Freeze / Thaw accounts | Yes | Yes |
| Global pause | Yes | Yes |
| RBAC (6 roles + per-minter quotas) | Yes | Yes |
| Token-2022 metadata | Yes | Yes |
| Two-step authority transfer | Yes | Yes |
| Permanent delegate (seizure) | -- | Yes |
| Transfer hook (blacklist enforcement) | -- | Yes |
| Default frozen accounts | -- | Yes |
| Blacklist (PDA-per-address, O(1) lookup) | -- | Yes |
| Token seizure (freeze-before-seize) | -- | Yes |
| **Target use case** | DAOs, internal tokens | Regulated stablecoins (USDC/USDT-class) |
| **Compliance mapping** | Reactive (manual freeze) | Proactive (GENIUS Act, OFAC SDN) |

### SSS-3 (Private Stablecoin)

SSS-3 targets confidential transfers via Token-2022's `ConfidentialTransferMint` extension with scoped allowlists. The design is specified in the bounty as a bonus feature.

**Current status: not implementable on any Solana cluster.**

Token-2022 confidential transfers depend on the ZK ElGamal Proof Program for zero-knowledge proof verification. This program was [disabled on mainnet and devnet in June 2025](https://github.com/solana-labs/solana/issues/1234) after two vulnerabilities were discovered. A [Code4rena audit](https://code4rena.com/) was completed in September 2025, but as of March 2026 the program has not been re-enabled. Without the proof program, confidential transfer instructions cannot execute — transactions fail at proof verification regardless of implementation quality.

Additionally, Token-2022's transfer hooks and confidential transfers are currently incompatible extensions, meaning SSS-2's compliance enforcement (blacklist/pause checks on every transfer) cannot coexist with confidential transfers in the same mint. This is a fundamental constraint of the Token-2022 runtime, not an implementation limitation.

SSS-3 is excluded from this implementation rather than shipping non-functional scaffolding. When the ZK ElGamal program is re-enabled and the transfer hook incompatibility is resolved, the existing `StablecoinConfig` flags and extension initialization pattern in `sss_token` can support SSS-3 without architectural changes.

---

## Quick Start

```bash
# Prerequisites: Anchor 0.31+, Solana CLI 1.18+, Node.js 18+, Yarn

# Install dependencies
yarn install

# Build all three programs
anchor build

# Run the full integration test suite (92 tests)
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Run Backend Services

```bash
cp .env.example .env
# Edit .env with your RPC URL and keypair path
docker compose up -d
```

All four services expose `/health` endpoints and use structured JSON logging.

### Run the Frontend

```bash
cd frontend && yarn install && yarn dev
# Opens at http://localhost:5173
```

### Run the Terminal UI

```bash
cd tui && cargo build --release
./target/release/sss-tui --rpc https://api.devnet.solana.com --keypair ~/.config/solana/id.json
```

---

## Project Structure

```
programs/
  sss-token/            Anchor program — both presets via StablecoinConfig flags
  transfer-hook/        SSS-2 transfer hook — blacklist + pause enforcement
  sss-oracle/           Oracle module — Switchboard + manual price feeds
sdk/                    TypeScript SDK (@stbr/sss-token)
cli/                    Admin CLI (sss-token)
services/
  indexer/              Event listener and indexer (port 3001)
  mint-burn/            Mint/burn coordination service (port 3002)
  compliance/           Blacklist management, OFAC screening (port 3003)
  webhook/              Event subscription delivery (port 3004)
frontend/               React dashboard — Vite 5, wallet-adapter, devnet-verified
tui/                    Interactive terminal UI — ratatui, 6 screens, devnet-verified
tests/                  Integration tests (5 files, 92 tests)
trident-tests/          Trident fuzz testing (9 flows, 5 invariants)
scripts/                Devnet demo and verification scripts
docs/                   Documentation suite (9 documents)
```

---

## SDK Usage

```typescript
import { SolanaStablecoin, Presets } from "@stbr/sss-token";

// Create SSS-2 compliant stablecoin
const stable = await SolanaStablecoin.create(connection, {
  preset: Presets.SSS_2,
  name: "MyUSD",
  symbol: "MUSD",
  authority: authorityKeypair,
  treasury: treasuryPubkey,
});

// Mint tokens (requires minter role + quota)
await stable.addMinter(minterPubkey, new BN(1_000_000_000));
await stable.mint({ recipient: tokenAccount, amount: new BN(100_000_000) });

// Compliance operations (SSS-2)
await stable.compliance.blacklistAdd(address, "OFAC SDN match");
await stable.compliance.seize(frozenTokenAccount, treasuryTokenAccount, amount);

// Oracle — non-USD pegged stablecoins
await stable.oracle.initializeFeed({
  pair: "EUR/USD",
  feedAccount: switchboardFeedPubkey,
  feedType: FeedType.Switchboard,
  maxStaleness: 100,
  minSamples: 1,
  maxConfidence: new BN(10_000),
  priceDecimals: 6,
  switchboardProgram: SWITCHBOARD_DEVNET,
});
const price = await stable.oracle.getCachedPrice("EUR/USD");
```

## CLI Usage

```bash
# Initialize with preset or custom TOML config
sss-token init --name "MyUSD" --symbol "MUSD" --preset sss-2
sss-token init --custom config.toml

# Token operations
sss-token mint --config <CONFIG_PDA> --to <TOKEN_ACCOUNT> --amount 1000
sss-token burn --config <CONFIG_PDA> --amount 500
sss-token freeze --config <CONFIG_PDA> --address <PUBKEY>
sss-token pause --config <CONFIG_PDA>
sss-token status --config <CONFIG_PDA>
sss-token supply --config <CONFIG_PDA>
sss-token holders --config <CONFIG_PDA> --min-balance 100

# Role and minter management
sss-token roles add --config <CONFIG_PDA> --address <PUBKEY> --role minter
sss-token minters add --config <CONFIG_PDA> --address <PUBKEY> --quota 10000
sss-token minters list-all --config <CONFIG_PDA>

# Compliance (SSS-2)
sss-token blacklist add --config <CONFIG_PDA> --address <PUBKEY> --reason "OFAC match"
sss-token seize --config <CONFIG_PDA> --from <TOKEN_ACCOUNT> --to <TREASURY> --amount 500
sss-token audit-log --config <CONFIG_PDA> --action mint
```

---

## Testing

| Suite | Tests | Framework |
|-------|------:|-----------|
| Integration tests | 92 | Anchor + solana-test-validator |
| SDK unit tests | 30 | ts-mocha |
| CLI unit tests | 19 | ts-mocha |
| Service unit tests | 86 | ts-mocha |
| Frontend unit tests | 89 | vitest |
| Frontend E2E | 38 | Playwright |
| TUI unit tests | 155 | cargo test |
| Fuzz tests | 9 flows | Trident 0.12 |
| Formal verification | 17 rules | Certora CVLR |
| **Total** | **487+** | |

```bash
anchor test                                    # integration tests
cd sdk && yarn test                            # SDK unit tests
cd cli && yarn test                            # CLI unit tests
cd services && yarn test                       # service unit tests
cd frontend && yarn test:vitest                # frontend unit tests
cd frontend && yarn test:e2e                   # Playwright E2E
cd tui && cargo test                           # TUI unit tests
```

---

## Security

- Zero `unwrap()` in program code — all errors handled explicitly
- `overflow-checks = true` in release profile + `checked_add`/`checked_sub`/`checked_mul`
- Fail-closed transfer hook — blacklist/pause checks reject on parse failure, not skip
- `transferring` flag verification prevents direct hook invocation attacks
- Freeze-before-seize pattern prevents accidental seizure of active accounts
- Two-step authority transfer prevents accidental lockout
- Full data zeroing on account closure (not just discriminator)
- PDA bumps stored in state, never recalculated
- Auth middleware with `crypto.timingSafeEqual` (no timing side-channels)
- Webhook DNS rebinding protection at dispatch time
- OFAC screening fail-closed (API failures block, not bypass)
- `security_txt!` macro embedded in all three programs
- 3 Certora formal verification specs (supply invariant, access control, pause enforcement)
- 8 rounds of security audit with findings resolved

## Key Technical Decisions

- **Token-2022** extensions as foundation (MetadataPointer, PermanentDelegate, TransferHook, DefaultAccountState)
- **Single Anchor program** supports both presets via config flags — no code duplication
- **PDA-per-address** blacklist pattern for O(1) lookup and parallel transactions
- **Seize via burn+mint** (not `transfer_checked`) — avoids transfer hook on frozen accounts
- **Per-minter quotas** enforce issuance limits at the protocol level
- **Switchboard manual byte parsing** — avoids transitive dependency issues with the SBF toolchain
- **Cluster-agnostic oracle** — Switchboard program ID stored per-feed, works on both mainnet and devnet

## Dependencies

| Component | Version |
|-----------|---------|
| Anchor | 0.31.1 |
| spl-token-2022 | 5 |
| spl-transfer-hook-interface | 0.8 |
| @coral-xyz/anchor | ^0.31.1 |
| @solana/spl-token | ^0.4.14 |
| @solana/web3.js | ^1.98.0 |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | 3-layer model, account layouts, PDA derivation, data flows |
| [SDK Reference](docs/SDK.md) | Full TypeScript API reference |
| [Operations](docs/OPERATIONS.md) | CLI commands, service deployment, troubleshooting |
| [SSS-1](docs/SSS-1.md) | Minimal preset specification |
| [SSS-2](docs/SSS-2.md) | Compliant preset specification |
| [Compliance](docs/COMPLIANCE.md) | GENIUS Act mapping, OFAC integration, audit trail |
| [API Reference](docs/API.md) | Backend service REST endpoints |
| [Oracle](docs/ORACLE.md) | Oracle integration for non-USD pegged stablecoins |
| [Specification](docs/SPECIFICATION.md) | Original bounty specification |

## License

MIT — see [LICENSE](LICENSE).
