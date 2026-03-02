# Operations Guide

Operator runbook for the Solana Stablecoin Standard. Covers CLI usage, step-by-step procedures for common operations, backend service deployment, and troubleshooting.

---

## CLI Reference

The `sss-token` CLI provides administrative control over stablecoin instances.

**Global options (all commands):**

| Flag | Default | Description |
|------|---------|-------------|
| `--cluster <url>` | `http://127.0.0.1:8899` | RPC endpoint. Also accepts `devnet` or `mainnet-beta`. Falls back to `ANCHOR_PROVIDER_URL` env var. |
| `--keypair <path>` | `~/.config/solana/id.json` | Signer keypair file. Falls back to `ANCHOR_WALLET` env var. |

### Initialization

```bash
# SSS-1 (minimal preset)
sss-token init --name "MyToken" --symbol "MTK" --preset sss-1

# SSS-2 (compliant preset)
sss-token init --name "ComplianceUSD" --symbol "CUSD" --preset sss-2

# Custom configuration via CLI flags (no preset)
sss-token init --name "CustomStable" --symbol "CS" \
  --decimals 9 \
  --permanent-delegate \
  --transfer-hook \
  --treasury <TREASURY_ADDRESS>

# Custom configuration from TOML file
sss-token init --custom config.toml
```

**All init options:**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--name <name>` | Yes* | — | Token name (max 32 chars) |
| `--symbol <symbol>` | Yes* | — | Token symbol (max 10 chars) |
| `--uri <uri>` | No | `""` | Metadata URI |
| `--decimals <n>` | No | `6` | Decimal places |
| `--preset <sss-1\|sss-2>` | No | — | Use preset configuration |
| `--custom <path>` | No | — | TOML config file (merged with CLI flags) |
| `--permanent-delegate` | No | `false` | Enable permanent delegate extension |
| `--transfer-hook` | No | `false` | Enable transfer hook extension |
| `--treasury <address>` | No | Authority pubkey | Treasury address |

*Can be provided via `--custom` TOML file instead of CLI flags. CLI flags take precedence.

**Output:** Prints the mint address and config PDA. Save the config PDA — it is needed for all subsequent commands.

#### TOML Configuration Format

```toml
name = "EuroStable"
symbol = "EURS"
uri = "https://example.com/eurs.json"
decimals = 6
preset = "sss-2"
treasury = "Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1"
cluster = "devnet"
keypair = "~/.config/solana/id.json"

# Extension flags (ignored if preset is set)
permanent_delegate = true
transfer_hook = true
default_account_frozen = false
```

Flat key-value format. CLI flags override TOML values when both are provided.

### Token Operations

```bash
sss-token mint    --config <PDA> --to <TOKEN_ACCOUNT> --amount 1000.50
sss-token burn    --config <PDA> --from <TOKEN_ACCOUNT> --amount 500
sss-token freeze  --config <PDA> --account <TOKEN_ACCOUNT>
sss-token thaw    --config <PDA> --account <TOKEN_ACCOUNT>
sss-token pause   --config <PDA>
sss-token unpause --config <PDA>
sss-token status  --config <PDA>
sss-token supply  --config <PDA>
```

Amounts are human-readable (e.g., `1000.50` for 1000.5 tokens). The CLI handles decimal conversion based on the stablecoin's configured decimals.

The `status` command displays: mint and config addresses, authority and treasury, decimals, paused state, total minted/burned/supply, extension flags, and pending authority transfer.

### Role Management

```bash
# Assign a role
sss-token roles add --config <PDA> --address <PUBKEY> --role <ROLE>

# Revoke a role
sss-token roles remove --config <PDA> --address <PUBKEY> --role <ROLE>

# Check if an address has a role
sss-token roles check --config <PDA> --address <PUBKEY> --role <ROLE>
```

Valid roles: `minter`, `burner`, `pauser`, `blacklister`, `seizer`.

### Minter Management

```bash
# Add a minter with quota (also assigns Minter role)
sss-token minters add --config <PDA> --address <PUBKEY> --quota 100000

# Remove a minter (closes MinterConfig PDA, returns rent)
sss-token minters remove --config <PDA> --address <PUBKEY>

# List all minters
sss-token minters list --config <PDA>

# Show a specific minter's quota
sss-token minters list --config <PDA> --address <PUBKEY>
```

### Query Commands

```bash
# Show current token supply
sss-token supply --config <PDA>

# List token holders (sorted by balance, descending)
sss-token holders --config <PDA>
sss-token holders --config <PDA> --min-balance 100

# Show recent on-chain events (audit log)
sss-token audit-log --config <PDA>
sss-token audit-log --config <PDA> --limit 50
sss-token audit-log --config <PDA> --action mint
```

The `holders` command queries Token-2022 accounts by mint filter (no `dataSize` filter — Token-2022 accounts with extensions are larger than legacy SPL accounts).

### Compliance Operations (SSS-2)

```bash
# Add to blacklist
sss-token blacklist add --config <PDA> --address <PUBKEY> --reason "OFAC SDN match"

# Remove from blacklist (soft delete — preserves audit trail)
sss-token blacklist remove --config <PDA> --address <PUBKEY>

# Check blacklist status
sss-token blacklist check --config <PDA> --address <PUBKEY>

# Seize tokens from a frozen account
sss-token seize --config <PDA> \
  --from <SOURCE_TOKEN_ACCOUNT> \
  --to <TREASURY_TOKEN_ACCOUNT> \
  --amount 1000
```

---

## Operator Procedures

### Procedure: Issue Tokens

**Prerequisite:** Stablecoin initialized, minter configured with sufficient quota.

```bash
# 1. Verify the stablecoin is not paused
sss-token status --config <PDA> --cluster devnet

# 2. Verify the minter has sufficient quota
sss-token minters list --config <PDA> --address <MINTER_PUBKEY> --cluster devnet

# 3. Ensure recipient has a Token-2022 ATA
#    (Create if needed — uses Token-2022 program ID)
spl-token create-account <MINT> --owner <RECIPIENT> \
  --fee-payer <PAYER> \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

# 4. Mint tokens
sss-token mint --config <PDA> --to <RECIPIENT_ATA> --amount 10000 \
  --keypair <MINTER_KEYPAIR> --cluster devnet

# 5. Verify supply and minter quota updated
sss-token supply --config <PDA> --cluster devnet
sss-token minters list --config <PDA> --address <MINTER_PUBKEY> --cluster devnet
```

### Procedure: Sanctions Response (Blacklist + Freeze + Seize)

**Prerequisite:** SSS-2 stablecoin. Operator has Blacklister, Authority (freeze), and Seizer roles.

```bash
# 1. Blacklist the sanctioned address
#    This prevents future transfers via transfer hook
sss-token blacklist add --config <PDA> --address <TARGET> \
  --reason "OFAC SDN match - [reference]" \
  --keypair <BLACKLISTER_KEYPAIR> --cluster devnet

# 2. Freeze the target's token account
#    Prevents all token operations on this account
sss-token freeze --config <PDA> --account <TARGET_ATA> --cluster devnet

# 3. Seize tokens to treasury
#    Target account MUST be frozen before seize (freeze-before-seize invariant)
sss-token seize --config <PDA> \
  --from <TARGET_ATA> \
  --to <TREASURY_ATA> \
  --amount <FULL_BALANCE> \
  --keypair <SEIZER_KEYPAIR> --cluster devnet

# 4. Verify the operation
sss-token audit-log --config <PDA> --action seize --cluster devnet
sss-token holders --config <PDA> --cluster devnet
```

The seize instruction uses burn+mint (not transfer) — it does not trigger the transfer hook and works on frozen accounts. The target account remains frozen after seizure.

### Procedure: Emergency Pause

**Prerequisite:** Operator has Pauser role.

```bash
# 1. Pause all operations
sss-token pause --config <PDA> --keypair <PAUSER_KEYPAIR> --cluster devnet

# 2. Verify paused state
sss-token status --config <PDA> --cluster devnet

# When paused:
# - Minting is blocked
# - Burning is blocked
# - All transfers are blocked (via transfer hook, SSS-2)
# - Freeze/thaw still works (authority needs to manage accounts)
# - Seize still works (GENIUS Act: law enforcement access during emergencies)

# 3. Resume operations
sss-token unpause --config <PDA> --keypair <PAUSER_KEYPAIR> --cluster devnet
```

### Procedure: Authority Transfer

**Prerequisite:** Current authority keypair available. New authority keypair ready.

```bash
# 1. Propose new authority (signed by current authority)
# SDK: await stable.proposeAuthority(newAuthorityPubkey);

# 2. Accept transfer (signed by new authority)
# SDK: await stable.acceptAuthority(newAuthorityKeypair);

# 3. Verify
sss-token status --config <PDA> --cluster devnet
# Authority field should show the new address
# Pending authority should be empty
```

Authority transfer is two-step (propose then accept) to prevent accidental lockout. If the wrong address is proposed, the current authority can propose a different address to overwrite the pending transfer.

**Oracle feed impact:** If oracle feeds exist, their stored authority is copied at initialization and not synced. After an authority transfer, close and recreate oracle feeds under the new authority.

### Procedure: Set Up Minting Operations

```bash
# 1. Create the stablecoin
sss-token init --name "MyUSD" --symbol "MUSD" --preset sss-2 --cluster devnet
# Save the config PDA from output

# 2. Assign roles for separation of duties
sss-token roles add --config <PDA> --address <MINTER_1> --role minter --cluster devnet
sss-token roles add --config <PDA> --address <PAUSER_1> --role pauser --cluster devnet
sss-token roles add --config <PDA> --address <BLACKLISTER_1> --role blacklister --cluster devnet
sss-token roles add --config <PDA> --address <SEIZER_1> --role seizer --cluster devnet
sss-token roles add --config <PDA> --address <BURNER_1> --role burner --cluster devnet

# 3. Configure minter quotas
sss-token minters add --config <PDA> --address <MINTER_1> --quota 1000000 --cluster devnet
# Minter can now mint up to 1,000,000 tokens

# 4. Verify setup
sss-token status --config <PDA> --cluster devnet
sss-token minters list --config <PDA> --cluster devnet
```

### Procedure: Oracle Price Feed Setup

For non-USD pegged stablecoins (e.g., EUR, BRL, CPI-indexed).

```typescript
import { SolanaStablecoin, FeedType } from "@stbr/sss-token";

// 1. Initialize a Switchboard feed
await stable.oracle.initializeFeed({
  pair: "EUR/USD",
  feedAccount: switchboardFeedPubkey,
  feedType: FeedType.Switchboard,
  maxStaleness: 100,                  // ~40 seconds at 400ms slots
  minSamples: 1,
  maxConfidence: new BN(10_000),      // max 0.01 std dev (6 decimals)
  priceDecimals: 6,
  switchboardProgram: new PublicKey("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2"),
});

// 2. Cache the price (permissionless — anyone can call)
await stable.oracle.cachePrice("EUR/USD", switchboardFeedPubkey);

// 3. Read the cached price
const price = await stable.oracle.getCachedPrice("EUR/USD");
console.log(`EUR/USD: ${price.price.toNumber() / 10 ** price.decimals}`);

// 4. For manual/CPI-indexed feeds
await stable.oracle.initializeFeed({
  pair: "CPI",
  feedAccount: PublicKey.default,
  feedType: FeedType.Manual,
  maxStaleness: 0, minSamples: 0,
  maxConfidence: new BN(0),
  priceDecimals: 6,
  switchboardProgram: PublicKey.default,
});
await stable.oracle.setManualPrice("CPI", new BN(102_500_000)); // 102.5
```

See [Oracle](ORACLE.md) for full reference.

---

## Frontend Dashboard

The React dashboard provides a web interface for all stablecoin operations.

```bash
cd frontend
yarn install
yarn dev          # Development server at http://localhost:5173
yarn build        # Production build (~894 KB, 260 KB gzipped)
```

**Pages:** Dashboard (supply, extensions, addresses), Create, Load, Operations (mint/burn/freeze/pause), Roles (role/minter management), Compliance (blacklist/seize).

Requires a Solana wallet extension (Phantom, Solflare). Connects via wallet-adapter. Session persistence stores the active config PDA in localStorage.

## Terminal UI

The interactive TUI provides real-time monitoring and operations from the terminal.

```bash
cd tui
cargo build --release
./target/release/sss-tui \
  --rpc https://api.devnet.solana.com \
  --keypair ~/.config/solana/id.json \
  --config <CONFIG_PDA>
```

**Screens:** Dashboard (supply, status, minter gauges, events), Operations (mint/burn/freeze/thaw/pause), Roles (role table, minter quota bars), Compliance (blacklist, seize), Events (real-time WebSocket stream), Holders (balance table).

Features: fail-safe transaction simulation, keypair zeroization, 15-second polling for public RPC compatibility, reconnecting WebSocket for live events.

---

## Backend Services Deployment

### Prerequisites

- Docker and Docker Compose
- PostgreSQL 16+ (provided via Docker Compose)
- Solana RPC endpoint (localnet, devnet, or mainnet)

### Quick Start

```bash
# 1. Copy environment config
cp .env.example .env

# 2. Edit .env with your values
#    RPC_URL, AUTHORITY_KEYPAIR are required
#    PROGRAM_ID and HOOK_PROGRAM_ID are pre-configured

# 3. Start all services
docker compose up -d

# 4. Check service health
curl http://localhost:3001/health  # indexer
curl http://localhost:3002/health  # mint-burn
curl http://localhost:3003/health  # compliance
curl http://localhost:3004/health  # webhook

# 5. View logs
docker compose logs -f              # all services
docker compose logs -f mint-burn    # specific service
```

### Service Architecture

| Service | Port | Description | Auth |
|---------|------|-------------|------|
| PostgreSQL | 5432 | Shared database | — |
| Redis | 6379 | Mint-burn queue | — |
| Indexer | 3001 | Event listener, Borsh decoder, WebSocket | Bearer |
| Mint-Burn | 3002 | Mint/burn request coordination | Bearer |
| Compliance | 3003 | Blacklist management, OFAC screening | Bearer |
| Webhook | 3004 | Event subscription delivery | Bearer |

All services use structured JSON logging (pino), Docker healthchecks, 256 MB memory limits, and 30-second graceful shutdown.

### Environment Variables

```bash
# Required
RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1
HOOK_PROGRAM_ID=7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj
AUTHORITY_KEYPAIR=[...]              # JSON array or path to keypair file

# PostgreSQL
POSTGRES_URL=postgresql://sss:sss@postgres:5432/sss
POSTGRES_USER=sss
POSTGRES_PASSWORD=sss
POSTGRES_DB=sss

# Service ports
PORT_INDEXER=3001
PORT_MINT_BURN=3002
PORT_COMPLIANCE=3003
PORT_WEBHOOK=3004

# Authentication (skip if unset — dev mode)
API_SECRET=your-secret-token         # Bearer token for service APIs

# Logging
LOG_LEVEL=info                       # debug, info, warn, error
```

### Authentication

When `API_SECRET` is set, all service endpoints require a Bearer token:

```bash
curl -H "Authorization: Bearer your-secret-token" http://localhost:3002/mint
```

Token validation uses `crypto.timingSafeEqual` to prevent timing side-channel attacks. When `API_SECRET` is unset, auth is skipped (development mode).

### Stopping Services

```bash
docker compose down        # Stop and remove containers
docker compose down -v     # Also remove volumes (deletes database)
```

---

## Monitoring

### Log Format

All services use structured JSON logging via pino:

```json
{"level":30,"time":1709049600000,"msg":"Indexed event","event":"MintEvent","sig":"5K..."}
```

Set `LOG_LEVEL=debug` for verbose output during development.

### Key Metrics

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Event indexing lag | Indexer logs | > 30s behind tip |
| Pending mint/burn requests | mint-burn DB | > 50 queued |
| Failed transactions | mint-burn logs | Any `status: failed` |
| Stale requests | mint-burn reconciliation | Any `processing` > 10 min |
| Blacklist add/remove events | Compliance audit log | Unexpected operator |
| Webhook delivery failures | Webhook logs | > 3 consecutive retries |
| WebSocket disconnects | Indexer logs | Frequent reconnects |

### Database Queries

```sql
-- Check recent events
SELECT * FROM events ORDER BY created_at DESC LIMIT 20;

-- Pending mint/burn requests
SELECT * FROM mint_burn_requests WHERE status = 'pending';

-- Stale requests (stuck in processing > 10 min)
SELECT * FROM mint_burn_requests
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '10 minutes';

-- Active blacklist entries
SELECT * FROM blacklist WHERE active = true;

-- Audit log for a specific action
SELECT * FROM audit_log WHERE action = 'seize' ORDER BY created_at DESC;
```

---

## Troubleshooting

### Program Error Reference

| Error | Code | Cause | Fix |
|-------|------|-------|-----|
| `Unauthorized` | 6000 | Signer doesn't have the required role | Assign role: `sss-token roles add` |
| `Paused` | 6001 | System is paused | Unpause: `sss-token unpause` |
| `NotPaused` | 6002 | Unpause called when not paused | System is already running |
| `AccountNotFrozen` | 6005 | Seize called on unfrozen account | Freeze first: `sss-token freeze` |
| `QuotaExceeded` | 6007 | Minter quota insufficient | Update quota: `sss-token minters add --quota <higher>` |
| `ComplianceNotEnabled` | 6009 | Blacklist/seize on SSS-1 stablecoin | Requires SSS-2 (permanent delegate + transfer hook) |
| `AlreadyBlacklisted` | 6010 | Address already has active entry | Remove first, then re-add to update reason |
| `InvalidMint` | 6021 | Mint doesn't match config | Verify correct config PDA |
| `PendingAuthorityMismatch` | 6014 | Wrong keypair accepting transfer | Only proposed authority can accept |
| `MinterAlreadyConfigured` | 6016 | Adding an existing minter | Use `updateMinterQuota` instead |
| `RoleAlreadyAssigned` | 6023 | Assigning an already-held role | Role is already active — no action needed |

### Common Issues

**"Account does not exist" when minting**

The recipient must have a Token-2022 associated token account for the stablecoin mint. Create one:

```bash
spl-token create-account <MINT> --owner <RECIPIENT> \
  --fee-payer <PAYER> \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
```

**Transfer hook rejects non-blacklisted addresses**

1. Verify ExtraAccountMetaList PDA was initialized:
   ```bash
   solana account <EXTRA_METAS_PDA> --output json
   ```
2. If missing, reinitialize via SDK:
   ```typescript
   await hookProgram.methods
     .initializeExtraAccountMetaList(SSS_TOKEN_PROGRAM_ID)
     .accounts({ payer, extraAccountMetaList, mint, config })
     .rpc();
   ```
3. Ensure `createTransferCheckedWithTransferHookInstruction` is used (not plain `transfer`).

**"Simulation failed" on devnet**

- Ensure sufficient SOL (at least 2 SOL for initialization — mint account + config PDA + extra metas PDA)
- Verify program IDs match deployed versions: `solana program show <PROGRAM_ID> --url devnet`
- Check that Anchor.toml cluster matches your target

**Docker services fail to start**

```bash
# Check PostgreSQL readiness
docker compose logs postgres

# Restart with fresh state
docker compose down -v && docker compose up -d

# Service-specific logs
docker compose logs -f mint-burn
```

**Blacklist not enforced during transfer**

- Confirm stablecoin initialized with `enable_transfer_hook: true` (`sss-token status`)
- Verify transfer hook program is deployed at expected ID
- Transfer must use `transfer_checked` (Token-2022), not legacy SPL `transfer`

### Devnet Deployment Checklist

```bash
# 1. Build all programs
anchor build

# 2. Verify program IDs match source
anchor keys list
# Compare with declare_id! in lib.rs and [programs.devnet] in Anchor.toml

# 3. Fund authority wallet
solana airdrop 5 --url devnet

# 4. Deploy
anchor deploy --provider.cluster devnet

# 5. Initialize a test stablecoin
sss-token init --name "TestUSD" --symbol "TUSD" --preset sss-2 --cluster devnet

# 6. Run integration tests
anchor test

# 7. Verify devnet deployment
npx ts-node scripts/devnet-verify.ts
```
