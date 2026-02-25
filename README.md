# Solana Stablecoin Standard (SSS)

An open-source SDK and standardized presets for stablecoins on Solana, built on Token-2022 extensions. Two Anchor programs, a TypeScript SDK, an admin CLI, and Docker-containerized backend services provide a complete infrastructure for issuing and managing stablecoins -- from minimal DAO tokens to regulatory-grade assets.

## Program IDs (Devnet)

| Program | ID |
|---------|-----|
| `sss_token` | [`Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1`](https://explorer.solana.com/address/Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1?cluster=devnet) |
| `transfer_hook` | [`7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj`](https://explorer.solana.com/address/7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj?cluster=devnet) |

### Example Transactions (Devnet)

| Operation | Signature |
|-----------|-----------|
| Initialize SSS-2 stablecoin | [`7tMPCz...sBmC`](https://explorer.solana.com/tx/7tMPCzEq9JoXeGz2xH9TPnM1boiWdYhpoarb5kh3uhsoCNCJ18H5D3phKQCCzkWQfuz79RpYYGNndHVgV1vsBmC?cluster=devnet) |
| Init transfer hook metas | [`39UV7w...dKuv`](https://explorer.solana.com/tx/39UV7wyaULMT4hc3XTPAXmaHjoKUwcTkL2J7572sd4JUvCYepVVbaPctoU16oozEPx1WpJztFSwVxjJmy6ZTdKuv?cluster=devnet) |
| Mint 1000 SDUSD | [`4MmYt9...v1Q`](https://explorer.solana.com/tx/4MmYt97FfZmiiEsbaYBDb7SQATpdHvZT66dyzFHiVzMyZY5FMXiBYH84byriDt2ua4Ypaema2G4mHP6nUW3htv1Q?cluster=devnet) |
| Pause | [`3bVZN4...ur2`](https://explorer.solana.com/tx/3bVZN4n58drBr7aQQ554FcTFQg9XDc6VoUXcSoNGvsqDcfahku88dnwr6NURnqGpPQobpB9ZJuNYrG8kUuZaEur2?cluster=devnet) |
| Unpause | [`2NUpz8...Ejz`](https://explorer.solana.com/tx/2NUpz8xg6xW2THvaU4pNotPXJuSy7y5D3yA3QTvR4uARH7VHDSgg7tZGvW5FKy1j95BaKeToJspvSyz9zyGKwEjz?cluster=devnet) |

Demo mint address: [`HbRVfD5HJupXhTKHB68KNV9RB6s2MsJwqTz5zFD5QNCt`](https://explorer.solana.com/address/HbRVfD5HJupXhTKHB68KNV9RB6s2MsJwqTz5zFD5QNCt?cluster=devnet)

## Architecture

```
Layer 3 (Presets)     SSS-1 (Minimal)  |  SSS-2 (Compliant)
Layer 2 (Modules)     Compliance: transfer hooks, blacklists, permanent delegate
Layer 1 (Base SDK)    Token creation, mint/freeze authorities, RBAC, metadata
```

**SSS-1** -- Basic mint/burn/freeze/pause with role-based access control. For internal tokens and DAOs.

**SSS-2** -- SSS-1 plus blacklist enforcement via transfer hook, token seizure via permanent delegate, and OFAC-grade compliance tooling. Maps directly to GENIUS Act requirements.

## Quick Start

```bash
# Prerequisites: Anchor 0.31+, Solana CLI, Node.js 18+, Yarn

# Build and run all 65 integration tests
anchor build && anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

## Project Structure

```
programs/
  sss-token/          Anchor program -- both presets via StablecoinConfig flags
  transfer-hook/      SSS-2 transfer hook -- blacklist + pause enforcement
sdk/                  TypeScript SDK (@stbr/sss-token)
cli/                  Admin CLI (sss-token)
services/
  indexer/            Event listener and indexer (port 3001)
  mint-burn/          Mint/burn coordination service (port 3002)
  compliance/         Blacklist management, OFAC screening (port 3003)
  webhook/            Event subscription delivery (port 3004)
tests/                Integration tests (4 test files, 65 tests)
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
| [Specification](docs/SPECIFICATION.md) | Original bounty specification |

## License

MIT -- see [LICENSE](LICENSE).
