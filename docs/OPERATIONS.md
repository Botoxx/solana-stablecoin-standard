# Operations Guide

## CLI Reference

The `sss-token` CLI provides administrative control over stablecoin instances. All commands accept `--cluster <url>` and `--keypair <path>` options.

**Global options:**

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

# Custom configuration (no preset)
sss-token init --name "CustomStable" --symbol "CS" \
  --decimals 9 \
  --permanent-delegate \
  --transfer-hook \
  --treasury <TREASURY_ADDRESS>

# Full options
sss-token init \
  --name <name>               # Required: token name (max 32 chars)
  --symbol <symbol>           # Required: token symbol (max 10 chars)
  --uri <uri>                 # Metadata URI (default: "")
  --decimals <n>              # Decimal places (default: 6)
  --preset <sss-1|sss-2>     # Use preset configuration
  --permanent-delegate        # Enable permanent delegate extension
  --transfer-hook             # Enable transfer hook extension
  --treasury <address>        # Treasury address (default: authority pubkey)
```

**Output:** Prints the mint address and config PDA. Save the config PDA -- it is needed for all subsequent commands.

### Token Operations

```bash
# Mint tokens to a recipient
sss-token mint \
  --config <CONFIG_PDA> \
  --to <TOKEN_ACCOUNT> \
  --amount 1000.50            # Human-readable amount (handles decimals)

# Burn tokens from your own account
sss-token burn \
  --config <CONFIG_PDA> \
  --from <TOKEN_ACCOUNT> \
  --amount 500

# Freeze a token account
sss-token freeze \
  --config <CONFIG_PDA> \
  --account <TOKEN_ACCOUNT>

# Thaw a frozen token account
sss-token thaw \
  --config <CONFIG_PDA> \
  --account <TOKEN_ACCOUNT>

# Pause the entire system
sss-token pause --config <CONFIG_PDA>

# Unpause
sss-token unpause --config <CONFIG_PDA>

# View status
sss-token status --config <CONFIG_PDA>
```

The `status` command displays:
- Mint and config addresses
- Authority and treasury
- Decimals, paused state
- Total minted, burned, and current supply
- Extension flags (permanent delegate, transfer hook, default frozen)
- Pending authority transfer (if any)

### Role Management

```bash
# Assign a role
sss-token roles add \
  --config <CONFIG_PDA> \
  --address <PUBKEY> \
  --role <minter|burner|pauser|blacklister|seizer>

# Revoke a role
sss-token roles remove \
  --config <CONFIG_PDA> \
  --address <PUBKEY> \
  --role <ROLE>

# Check if an address has a role
sss-token roles check \
  --config <CONFIG_PDA> \
  --address <PUBKEY> \
  --role <ROLE>
```

### Minter Management

```bash
# Add a minter with quota (also assigns Minter role)
sss-token minters add \
  --config <CONFIG_PDA> \
  --address <PUBKEY> \
  --quota 100000              # Human-readable quota

# Remove a minter (closes MinterConfig PDA)
sss-token minters remove \
  --config <CONFIG_PDA> \
  --address <PUBKEY>

# View minter info and remaining quota
sss-token minters info \
  --config <CONFIG_PDA> \
  --address <PUBKEY>
```

### Compliance Operations (SSS-2)

```bash
# Add to blacklist
sss-token blacklist add \
  --config <CONFIG_PDA> \
  --address <PUBKEY> \
  --reason "OFAC SDN match"

# Remove from blacklist (soft delete)
sss-token blacklist remove \
  --config <CONFIG_PDA> \
  --address <PUBKEY>

# Check blacklist status
sss-token blacklist check \
  --config <CONFIG_PDA> \
  --address <PUBKEY>

# Seize tokens from a frozen account
sss-token seize \
  --config <CONFIG_PDA> \
  --from <SOURCE_TOKEN_ACCOUNT> \   # Must be frozen
  --to <TREASURY_TOKEN_ACCOUNT> \
  --amount 1000
```

---

## Backend Services Deployment

### Prerequisites

- Docker and Docker Compose
- PostgreSQL 16+ and Redis 7+ (provided via Docker Compose)
- Solana RPC endpoint (localnet, devnet, or mainnet)

### Quick Start

```bash
# 1. Copy environment config
cp .env.example .env

# 2. Edit .env with your values
#    - RPC_URL: your Solana RPC endpoint
#    - PROGRAM_ID / HOOK_PROGRAM_ID: already set to defaults
#    - AUTHORITY_KEYPAIR_PATH: path to operator keypair

# 3. Start all services
docker compose up -d

# 4. Check service health
curl http://localhost:3001/health  # indexer
curl http://localhost:3002/health  # mint-burn
curl http://localhost:3003/health  # compliance
curl http://localhost:3004/health  # webhook

# 5. View logs
docker compose logs -f              # all services
docker compose logs -f indexer      # specific service
docker compose logs -f compliance
```

### Service Ports

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Shared database |
| Redis | 6379 | Job queue (mint-burn) |
| Indexer | 3001 | Event listener and query API |
| Mint-Burn | 3002 | Mint/burn request coordination |
| Compliance | 3003 | Blacklist management and screening |
| Webhook | 3004 | Event subscription delivery |

### Environment Variables

```bash
# Required
RPC_URL=http://127.0.0.1:8899       # Solana RPC endpoint
PROGRAM_ID=Fjv9YM4...               # sss-token program ID
HOOK_PROGRAM_ID=7z98ECJ...          # transfer-hook program ID
AUTHORITY_KEYPAIR_PATH=~/.config/solana/id.json

# PostgreSQL
POSTGRES_URL=postgresql://sss:sss@localhost:5432/sss
POSTGRES_USER=sss
POSTGRES_PASSWORD=sss
POSTGRES_DB=sss

# Redis
REDIS_URL=redis://localhost:6379

# Service ports (customize if needed)
PORT_INDEXER=3001
PORT_MINT_BURN=3002
PORT_COMPLIANCE=3003
PORT_WEBHOOK=3004

# Logging
LOG_LEVEL=info                       # debug, info, warn, error
```

### Health Endpoints

Every service exposes `GET /health`:

```json
{
  "status": "ok",
  "service": "indexer",
  "timestamp": "2026-02-24T12:00:00.000Z",
  "uptime": 86400000
}
```

Use these for Docker healthchecks, load balancer probes, and monitoring.

### Resource Limits

Each service is configured with a 256MB memory limit in Docker Compose. Adjust in `docker-compose.yml` under `deploy.resources.limits.memory` if needed.

### Stopping Services

```bash
docker compose down        # Stop and remove containers
docker compose down -v     # Also remove volumes (deletes database!)
```

---

## Monitoring

### Log Format

All services use structured JSON logging via [Pino](https://github.com/pinojs/pino):

```json
{"level":30,"time":1709049600000,"msg":"Indexed event","event":"MintEvent","sig":"5K..."}
```

Set `LOG_LEVEL=debug` for verbose output during development.

### Key Metrics to Monitor

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Event indexing lag | indexer logs | > 30s behind tip |
| Pending mint/burn requests | `GET /requests?status=pending` | > 50 queued |
| Failed transactions | mint-burn service logs | Any `status: failed` |
| Blacklist add/remove events | compliance audit log | Unexpected operator |
| Webhook delivery failures | webhook service logs | > 3 consecutive retries |

### Database Queries

```sql
-- Check recent events
SELECT * FROM events ORDER BY created_at DESC LIMIT 20;

-- Pending mint/burn requests
SELECT * FROM mint_burn_requests WHERE status = 'pending';

-- Active blacklist entries
SELECT * FROM blacklist WHERE active = true;

-- Audit log for a specific action
SELECT * FROM audit_log WHERE action = 'blacklist_add' ORDER BY created_at DESC;
```

---

## Troubleshooting

### Program Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Unauthorized` | Signer doesn't have the required role | Check role assignment with `sss-token roles check` |
| `Paused` | System is paused | Unpause with a Pauser key: `sss-token unpause` |
| `QuotaExceeded` | Minter's remaining quota < requested amount | Update quota: `sss-token minters add` with higher quota |
| `AccountNotFrozen` | Seize called on an unfrozen account | Freeze first: `sss-token freeze` |
| `ComplianceNotEnabled` | Blacklist/seize called on SSS-1 stablecoin | These features require SSS-2 (permanent delegate + transfer hook) |
| `AlreadyBlacklisted` | Address already has an active blacklist entry | Remove first, then re-add if updating reason |
| `InvalidMint` | Mint account doesn't match config | Verify you're using the correct config PDA |
| `PendingAuthorityMismatch` | Wrong keypair trying to accept authority | Only the proposed authority can accept |
| `MinterAlreadyConfigured` | Calling add on an existing minter | Use `updateQuota` instead |

### Common Issues

**"Account does not exist" when minting**

The recipient must have a Token-2022 associated token account for the stablecoin mint. Create one first:

```typescript
const ata = await stable.createTokenAccount(payer, recipientPubkey);
```

Or via CLI:
```bash
spl-token create-account <MINT_ADDRESS> --owner <RECIPIENT> --fee-payer <PAYER> --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
```

**Transfer hook rejects transfer for non-blacklisted addresses**

Verify the ExtraAccountMetaList PDA was initialized:
```bash
solana account <EXTRA_METAS_PDA> --output json
```

If it doesn't exist, reinitialize:
```typescript
const hookProgram = new Program<TransferHook>(transferHookIdl, provider);
await hookProgram.methods
  .initializeExtraAccountMetaList(SSS_TOKEN_PROGRAM_ID)
  .accounts({ payer, extraAccountMetaList, mint, config })
  .rpc();
```

**"Simulation failed" on devnet**

- Ensure sufficient SOL for rent + transaction fees (at least 2 SOL for initialization)
- Verify program IDs match the deployed versions
- Check that Anchor.toml cluster matches your target

**Docker services fail to start**

```bash
# Check if PostgreSQL is ready
docker compose logs postgres

# Restart with fresh volumes
docker compose down -v && docker compose up -d

# Check service-specific logs
docker compose logs -f mint-burn
```

**Blacklist entries not being checked during transfer**

- Confirm the stablecoin was initialized with `enable_transfer_hook: true`
- Verify the transfer hook program is deployed at the expected ID
- Ensure `createTransferCheckedWithTransferHookInstruction` is used (not plain `transfer`)

### Devnet Deployment Checklist

1. Build programs: `anchor build`
2. Verify program IDs match `Anchor.toml` and `declare_id!` in source
3. Deploy: `anchor deploy --provider.cluster devnet`
4. Fund authority wallet: `solana airdrop 5 --url devnet`
5. Initialize stablecoin: `sss-token init --preset sss-2 --name "TestUSD" --symbol "TUSD" --cluster devnet`
6. Run integration tests against devnet: `anchor test --provider.cluster devnet`
