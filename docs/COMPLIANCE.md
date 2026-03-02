# Compliance Guide

## GENIUS Act Mapping

The Guiding and Establishing National Innovation for US Stablecoins (GENIUS) Act imposes specific technical and operational requirements on stablecoin issuers. SSS-2 maps each requirement to an on-chain mechanism.

| GENIUS Act Requirement | SSS-2 Implementation | Enforcement |
|----------------------|---------------------|-------------|
| **Sanctions screening** | Blacklist enforcement via transfer hook. BlacklistEntry PDAs checked on every transfer. | On-chain: transfer hook rejects transfers to/from blacklisted addresses |
| **Block, freeze, reject impermissible transactions** | Freeze (per-account), pause (global), blacklist (per-address), transfer hook (per-transfer) | On-chain: config PDA holds freeze authority; hook enforces blacklist |
| **Asset recovery from sanctioned persons** | Seize instruction: thaw -> burn -> mint to treasury -> re-freeze | On-chain: permanent delegate enables burn from any account |
| **Secondary market enforcement** | Transfer hook runs on all `transfer_checked` calls, including DEX trades and P2P transfers | On-chain: Token-2022 invokes hook automatically |
| **Audit trail** | All operations emit Anchor events with operator pubkey and Unix timestamp | On-chain events + off-chain indexer |
| **Annual compliance certification** | Audit log queryable via compliance service (`GET /audit-log`); event indexer stores all state changes | Off-chain: compliance service + indexer |
| **Issuance controls** | Per-minter quotas tracked in MinterConfig PDAs | On-chain: quota check before every mint |
| **Role separation** | 6 distinct roles with PDA-based verification; Blacklister separate from Seizer | On-chain: RBAC via PDA seeds |

## OFAC Screening Integration

The compliance service provides a pluggable screening provider interface.

### ScreeningProvider Interface

```typescript
interface ScreeningResult {
  address: string;
  flagged: boolean;
  source: string;
  matchType?: string;   // "exact", "fuzzy", "associated"
  details?: string;     // Human-readable match details
}

interface ScreeningProvider {
  screen(address: string): Promise<ScreeningResult>;
}
```

### Built-in Providers

**OFACScreeningProvider** -- OFAC SDN (Specially Designated Nationals) list integration. Operates in two modes:

- **Stub mode** (default, when `OFAC_API_URL` is not set): Returns `{ flagged: false, source: "OFAC_SDN_STUB" }` for all addresses. Logs a warning at startup.
- **Live mode** (when `OFAC_API_URL` is set): Calls the API and **fails closed** -- if the API is unreachable or returns an error, the screen throws rather than returning a false "clean" result.

```typescript
class OFACScreeningProvider implements ScreeningProvider {
  constructor() {
    this.apiUrl = process.env.OFAC_API_URL;
  }

  async screen(address: string): Promise<ScreeningResult> {
    if (!this.apiUrl) {
      return { address, flagged: false, source: "OFAC_SDN_STUB" };
    }
    // Real API call -- throws on failure (fail-closed)
    const response = await fetch(`${this.apiUrl}/screen?address=${address}`);
    if (!response.ok) throw new Error(`OFAC API returned ${response.status}`);
    const data = await response.json();
    return { address, flagged: !!data.flagged, source: "OFAC_SDN", matchType: data.matchType };
  }
}
```

**CompositeScreeningProvider** -- Chains multiple providers, returns first match:

```typescript
class CompositeScreeningProvider implements ScreeningProvider {
  constructor(private providers: ScreeningProvider[]) {}

  async screen(address: string): Promise<ScreeningResult> {
    for (const provider of this.providers) {
      const result = await provider.screen(address);
      if (result.flagged) return result;
    }
    return { address, flagged: false, source: "composite" };
  }
}
```

### Production Integration

To integrate a real screening provider (Chainalysis, Elliptic, TRM Labs, etc.):

1. Implement the `ScreeningProvider` interface with your vendor's API
2. Register it in the compliance service's provider chain
3. Call `POST /screen` before any whitelist/ATA creation
4. Automatically trigger `add_to_blacklist` on matches

Example production flow:

```
New user requests ATA creation
    |
    v
POST /screen { address: "user_pubkey" }
    |
    +-- Provider 1: OFAC SDN list --> not flagged
    +-- Provider 2: Chainalysis API --> FLAGGED (sanctioned entity)
    |
    v
{ flagged: true, source: "chainalysis", matchType: "associated", details: "..." }
    |
    v
Automatically call add_to_blacklist(address, reason)
Reject ATA creation
Log to audit trail
```

### API Endpoints

```bash
# Screen an address
POST /screen
Body: { "address": "abc123..." }
Response: { "address": "abc123...", "flagged": false, "source": "OFAC_SDN" }

# Blacklist management
POST /blacklist
Body: { "address": "abc123...", "reason": "OFAC match", "operator": "compliance-admin" }

DELETE /blacklist/:address

GET /blacklist?limit=50&offset=0
```

## Audit Trail Design

### On-Chain Events

Every state-changing instruction emits an Anchor event. Events are the primary audit data source.

| Event | Key Fields | Compliance Relevance |
|-------|-----------|---------------------|
| InitializeEvent | authority, mint, extension flags, timestamp | Token creation record |
| MintEvent | authority, minter, recipient, amount, remaining_quota, timestamp | Issuance tracking |
| BurnEvent | authority, burner, amount, timestamp | Redemption tracking |
| FreezeEvent | authority, account, timestamp | Account restriction |
| ThawEvent | authority, account, timestamp | Account unrestriction |
| PauseEvent | authority, timestamp | System-wide halt |
| UnpauseEvent | authority, timestamp | System resumption |
| MinterUpdatedEvent | authority, minter, quota_total, quota_remaining, action, timestamp | Issuance limit changes |
| RoleUpdatedEvent | authority, address, role, action, timestamp | Access control changes |
| AuthorityProposedEvent | authority, proposed, timestamp | Authority transfer initiation |
| AuthorityAcceptedEvent | old_authority, new_authority, timestamp | Authority transfer completion |
| BlacklistAddEvent | authority, address, reason, timestamp | Sanctions enforcement |
| BlacklistRemoveEvent | authority, address, timestamp | Sanctions clearance |
| SeizeEvent | authority, source, treasury, amount, timestamp | Asset confiscation |

The oracle program (`sss_oracle`) emits 5 additional events (FeedInitialized, FeedConfigUpdated, PriceCached, ManualPriceSet, FeedClosed) — see [ORACLE.md](ORACLE.md) for details.

### Off-Chain Indexer

The indexer service subscribes to on-chain program logs and stores parsed events in PostgreSQL:

```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL,          -- Event type (e.g., "BlacklistAddEvent")
  authority VARCHAR(64),               -- Operator who triggered the event
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature VARCHAR(128) NOT NULL,     -- Transaction signature
  slot BIGINT,
  data JSONB,                          -- Full event data
  UNIQUE(signature, name)
);
```

### Compliance Service Audit Log

The compliance service maintains an additional audit log for compliance-specific actions:

```sql
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  action VARCHAR(64) NOT NULL,         -- "blacklist_add", "blacklist_remove", "screen", "seize"
  operator VARCHAR(64),                -- Who triggered the action
  target VARCHAR(64),                  -- Target address (if applicable)
  details JSONB,                       -- Action-specific data (reason, amounts, etc.)
  signature VARCHAR(128),              -- Transaction signature (for on-chain actions)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Query the audit log:

```bash
# All compliance actions
GET /audit-log?limit=100

# Filter by action type
GET /audit-log?action=blacklist_add&limit=50

# Filter by date range (via SQL in production)
```

### Audit Trail Properties

| Property | Mechanism |
|----------|-----------|
| **Immutability** | On-chain events are part of the transaction log and cannot be modified |
| **Operator identity** | Every event includes the signer's public key |
| **Timestamp** | On-chain `Clock::get()` provides trusted timestamps |
| **Completeness** | All state changes emit events; no silent mutations |
| **Queryability** | Indexed in PostgreSQL with full-text search on event data |
| **Retention** | On-chain data persists indefinitely; off-chain indexed data retained per policy |

## Role Separation Rationale

### Why Separate Blacklister and Seizer?

Real-world compliance requires separation of duties:

1. **Screening team** (Blacklister role): Monitors addresses against sanctions lists, makes determination to block. This is often automated or performed by compliance analysts.

2. **Enforcement team** (Seizer role): Executes asset recovery actions. This requires management approval and involves moving funds to a custody address.

3. **Authority** (Master Authority): Performs freeze operations. Freeze is a prerequisite for seizure but doesn't require the Seizer role.

The workflow:

```
Compliance analyst identifies sanctioned address
    |-- Blacklister: add_to_blacklist(address, "OFAC SDN match")
    |   (address is now blocked from all transfers)
    |
    v
Legal/management approval for asset recovery
    |-- Authority: freeze_account(target_ata)
    |   (account locked, cannot be thawed without authority)
    |
    v
Compliance enforcement executes seizure
    |-- Seizer: seize(target_ata, treasury_ata, amount)
    |   (tokens moved to treasury, source re-frozen)
    |
    v
Audit trail records all three actions with separate operators
```

### Multiple Addresses Per Role

Multiple addresses can hold the same role. This supports:

- **Rotating keys** without downtime
- **Team access** (multiple compliance officers)
- **Automation** (separate keys for automated screening vs manual override)
- **Geographic distribution** (regional compliance teams)

## Recommended Production Deployment

### Authority Management

Use **Squads Protocol** (multisig) for the master authority:

```
Squads Multisig (3-of-5 threshold)
    |
    v
Master Authority of StablecoinConfig
    |
    +-- Controls freeze/thaw
    +-- Assigns/revokes all roles
    +-- Transfers authority (two-step)
```

Benefits:
- No single point of failure
- Requires multiple signers for critical operations
- Hardware wallet support per signer
- On-chain audit trail of multisig approvals

### Role Key Management

| Role | Recommended Setup |
|------|-------------------|
| Master Authority | Squads multisig (3-of-5 or higher) |
| Minter | Dedicated server key with quota limits; rotate quarterly |
| Burner | Dedicated server key; minimal exposure |
| Pauser | Hot key accessible for emergency use; separate from authority |
| Blacklister | Compliance team keys; can be automated (API-driven) |
| Seizer | High-security key; requires management approval workflow |

### Infrastructure

```
[Screening Provider API] ---> [Compliance Service] ---> [On-Chain Blacklist]
                                     |
                                     v
[Event Indexer] <--- [Solana RPC] ---> [Webhook Service] ---> [Alert Endpoints]
                                     |
                                     v
                              [Mint-Burn Service] <--- [Internal API]
```

- All services behind VPN or authentication gateway
- Secrets (keypairs, API keys) in Vault or AWS Secrets Manager
- Database backups for audit log retention
- Monitoring and alerting on all compliance operations

### Compliance Checklist

- [ ] Master authority is a multisig (Squads)
- [ ] All roles assigned to appropriate keys
- [ ] Screening provider integrated and tested
- [ ] Indexer running and storing events
- [ ] Audit log retention policy defined (7+ years for financial compliance)
- [ ] Incident response runbook for sanctions matches
- [ ] Quarterly review of minter quotas
- [ ] Annual compliance certification documentation
- [ ] Emergency pause procedure documented and tested
- [ ] Key rotation schedule established
