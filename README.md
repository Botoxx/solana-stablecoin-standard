# Solana Stablecoin Standard (SSS)

An open-source SDK and standardized presets for stablecoins on Solana, built on Token-2022 extensions. Three Anchor programs, a TypeScript SDK, an admin CLI, and Docker-containerized backend services provide a complete infrastructure for issuing and managing stablecoins -- from minimal DAO tokens to regulatory-grade assets.

## Program IDs (Devnet)

| Program | ID |
|---------|-----|
| `sss_token` | [`Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1`](https://explorer.solana.com/address/Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1?cluster=devnet) |
| `transfer_hook` | [`7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj`](https://explorer.solana.com/address/7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj?cluster=devnet) |
| `sss_oracle` | [`ADuTfewteACQzaBpxB2ShicPZVgzW21XMA64Y84pg92k`](https://explorer.solana.com/address/ADuTfewteACQzaBpxB2ShicPZVgzW21XMA64Y84pg92k?cluster=devnet) |

### Example Transactions (Devnet)

| Operation | Signature |
|-----------|-----------|
| Mint 1000 SDUSD | [`2HGLkZ...5DKv`](https://explorer.solana.com/tx/2HGLkZFjYAznVGhbHUnuoaXV3H1pUgaw61Ut7xagmGByoSKZbYZdRPTB5KaAf2ZFVaSpNq2MTHJGJUEPAyZp5DKv?cluster=devnet) |
| Blacklist address | [`5Tjk4b...6sA4`](https://explorer.solana.com/tx/5Tjk4bJoj5Luakj3B9548Wz3waLaFoqXkNA61BvS9V8U9oANhwCfSqU9DfMQd9tLK57xF5oFAfp15QD58yWz6sA4?cluster=devnet) |
| Unblacklist address | [`G7FAtS...xUeL`](https://explorer.solana.com/tx/G7FAtSn9j2d2XCn7mPVqGxszcmZhjFTEo2f5Co8YPDqoDqWnK24yVrYjtrCvjkEckqq2XzzNbTYrhhC8xocxUeL?cluster=devnet) |

Demo mint: [`AHAZWMZuSRPA94qyEzN7H6BsrMwnTr3ZofeXsUZ6wUms`](https://explorer.solana.com/address/AHAZWMZuSRPA94qyEzN7H6BsrMwnTr3ZofeXsUZ6wUms?cluster=devnet)

## Architecture

```
Layer 3 (Presets)     SSS-1 (Minimal)  |  SSS-2 (Compliant)
Layer 2 (Modules)     Compliance: transfer hooks, blacklists, permanent delegate
                      Oracle: Switchboard On-Demand + manual price feeds (non-USD pegs)
Layer 1 (Base SDK)    Token creation, mint/freeze authorities, RBAC, metadata
```

**SSS-1** -- Basic mint/burn/freeze/pause with role-based access control. For internal tokens and DAOs.

**SSS-2** -- SSS-1 plus blacklist enforcement via transfer hook, token seizure via permanent delegate, and OFAC-grade compliance tooling. Maps directly to GENIUS Act requirements.

## Quick Start

```bash
# Prerequisites: Anchor 0.31+, Solana CLI, Node.js 18+, Yarn

# Build and run all 88 integration tests
anchor build && anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

## Project Structure

```
programs/
  sss-token/          Anchor program -- both presets via StablecoinConfig flags
  transfer-hook/      SSS-2 transfer hook -- blacklist + pause enforcement
  sss-oracle/         Oracle module -- Switchboard + manual price feeds
sdk/                  TypeScript SDK (@stbr/sss-token)
cli/                  Admin CLI (sss-token)
services/
  indexer/            Event listener and indexer (port 3001)
  mint-burn/          Mint/burn coordination service (port 3002)
  compliance/         Blacklist management, OFAC screening (port 3003)
  webhook/            Event subscription delivery (port 3004)
tests/                Integration tests (5 test files, 88 tests)
docs/                 Documentation suite
```

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
```

## CLI Usage

```bash
# Initialize
sss-token init --name "MyUSD" --symbol "MUSD" --preset sss-2

# Mint
sss-token mint --config <CONFIG_PDA> --to <TOKEN_ACCOUNT> --amount 1000

# Manage roles
sss-token roles add --config <CONFIG_PDA> --address <PUBKEY> --role minter
sss-token minters add --config <CONFIG_PDA> --address <PUBKEY> --quota 10000

# Compliance (SSS-2)
sss-token blacklist add --config <CONFIG_PDA> --address <PUBKEY> --reason "OFAC match"
sss-token seize --config <CONFIG_PDA> --from <TOKEN_ACCOUNT> --to <TREASURY> --amount 500
```

## Backend Services

```bash
cp .env.example .env
# Edit .env with your RPC URL and keypair path
docker compose up -d
```

All services expose `/health` endpoints and use structured JSON logging.

## Key Technical Decisions

- **Token-2022** extensions as foundation (MetadataPointer, PermanentDelegate, TransferHook, DefaultAccountState)
- **Single Anchor program** supports both presets via config flags
- **PDA-per-address** blacklist pattern (not Vec in single account) for O(1) lookup
- **Freeze-before-seize** pattern prevents accidental seizure of active accounts
- **Two-step authority transfer** (propose then accept) prevents accidental lockout
- **Per-minter quotas** enforce issuance limits at the protocol level

## Dependencies

| Component | Version |
|-----------|---------|
| Anchor | 0.31.1 |
| spl-token-2022 | 5 |
| spl-transfer-hook-interface | 0.8 |
| @coral-xyz/anchor | ^0.31.1 |
| @solana/spl-token | ^0.4.14 |
| @solana/web3.js | ^1.98.0 |

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

MIT -- see [LICENSE](LICENSE).
