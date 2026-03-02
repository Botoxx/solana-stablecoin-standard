# Architecture

## 3-Layer Model

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 3: Presets                                                   │
│  ┌───────────────────────────┐  ┌─────────────────────────────────┐ │
│  │ SSS-1 (Minimal)           │  │ SSS-2 (Compliant)               │ │
│  │ mint/burn/freeze/pause    │  │ SSS-1 + blacklist + seizure     │ │
│  │ RBAC (4 roles)            │  │ RBAC (6 roles) + transfer hook  │ │
│  └───────────────────────────┘  └─────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 2: Modules                                                   │
│  ┌───────────────────────────┐  ┌─────────────────────────────────┐ │
│  │ Compliance                │  │ Oracle                          │ │
│  │ - Transfer hooks          │  │ - Switchboard On-Demand feeds   │ │
│  │ - Blacklists (PDA/addr)   │  │ - Manual/CPI-indexed feeds     │ │
│  │ - Permanent delegate      │  │ - Per-stablecoin, per-pair      │ │
│  └───────────────────────────┘  └─────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 1: Base SDK                                                  │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Token creation (Token-2022) │ Mint/freeze authorities          │ │
│  │ MetadataPointer + embedded  │ Role-based access control        │ │
│  │ TokenMetadata               │ TypeScript SDK + Admin CLI       │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

Layers compose upward. SSS-1 uses Layer 1 only. SSS-2 adds Layer 2 compliance modules. Each preset is a configuration of the same Anchor program — no separate program per preset. The oracle module is independent and works with either preset.

---

## Program Architecture

Three on-chain programs cooperate:

```
                       sss-token program
                  (Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1)
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
  Core Instructions    Compliance Instr.    Token-2022 CPI
  (initialize, mint,   (add_to_blacklist,   (mint_to, burn,
   burn, freeze, thaw,  remove_from_bl,      freeze_account,
   pause, update_*)     seize)               thaw_account)
                            │
                            │ reads BlacklistEntry PDAs
                            │
                   transfer-hook program
              (7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj)
                            │
              Called by Token-2022 on every transfer
              Checks: paused flag, sender blacklist, recipient blacklist


                       sss-oracle program
                  (ADuTfewteACQzaBpxB2ShicPZVgzW21XMA64Y84pg92k)
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
  Switchboard feeds    Manual feeds        Feed management
  (cache_price)        (set_manual_price)  (initialize_feed,
                                            update_feed_config,
                                            close_feed)
                            │
              Reads StablecoinConfig authority via raw bytes
              Zero modifications to sss-token or transfer-hook
```

The transfer hook program is registered at mint creation when `enable_transfer_hook = true`. Token-2022 invokes it automatically on every `transfer_checked` call. The hook reads `StablecoinConfig` (for the paused flag) and `BlacklistEntry` PDAs (for sender/recipient status) from the sss-token program — it does not own those accounts.

The oracle program is fully independent. It reads the stablecoin authority from `StablecoinConfig` via raw byte parsing (same fail-closed pattern as the transfer hook) and stores per-pair price feeds in its own PDA namespace.

---

## Account Layout

### StablecoinConfig (256 bytes)

The central configuration account. One per stablecoin mint.

```
Offset  Size  Field                     Type
------  ----  -----                     ----
0       8     discriminator             [u8; 8]
8       32    authority                 Pubkey
40      1+32  pending_authority         Option<Pubkey>
73      32    mint                      Pubkey
105     32    treasury                  Pubkey
137     1     decimals                  u8
138     1     paused                    bool
139     1     enable_permanent_delegate bool
140     1     enable_transfer_hook      bool
141     1     default_account_frozen    bool
142     1+32  transfer_hook_program     Option<Pubkey>
175     8     total_minted              u64
183     8     total_burned              u64
191     1     bump                      u8
192     64    _reserved                 [u8; 64]
------
Total: 256 bytes (8 discriminator + 248 fields)
```

**Design note (spec §3.1):** `name`, `symbol`, and `uri` are stored in Token-2022's native MetadataPointer + TokenMetadata extensions (the PYUSD pattern) rather than duplicated here. This avoids double rent costs and a two-source-of-truth consistency problem. Query metadata via `spl_token_metadata_interface` or the SDK.

The `_reserved` field (64 bytes) provides space for future upgrades without reallocation.

### MinterConfig (153 bytes)

Per-minter quota tracking. One per (config, minter) pair.

```
Offset  Size  Field           Type
------  ----  -----           ----
0       8     discriminator   [u8; 8]
8       32    config          Pubkey
40      32    minter          Pubkey
72      8     quota_total     u64
80      8     quota_remaining u64
88      1     bump            u8
89      64    _reserved       [u8; 64]
------
Total: 153 bytes
```

### RoleAssignment (178 bytes)

RBAC assignment record. One per (config, role_type, address) tuple.

```
Offset  Size  Field           Type
------  ----  -----           ----
0       8     discriminator   [u8; 8]
8       32    config          Pubkey
40      1     role_type       u8 (0=Minter, 1=Burner, 2=Pauser, 3=Blacklister, 4=Seizer)
41      32    address         Pubkey
73      32    assigned_by     Pubkey
105     8     assigned_at     i64
113     1     bump            u8
114     64    _reserved       [u8; 64]
------
Total: 178 bytes
```

### BlacklistEntry (310 bytes)

PDA-per-address blacklist record. Soft-deleted (active flag) to preserve audit trail.

```
Offset  Size    Field            Type
------  ----    -----            ----
0       8       discriminator    [u8; 8]
8       32      config           Pubkey
40      32      address          Pubkey
72      4+128   reason           String (4-byte len prefix + max 128 bytes)
204     8       blacklisted_at   i64
212     32      blacklisted_by   Pubkey
244     1       active           bool
245     1       bump             u8
246     64      _reserved        [u8; 64]
------
Total: 310 bytes
```

### OracleFeedConfig (253 bytes)

Per-pair price feed configuration. One per (config, pair) combination. Owned by `sss_oracle`.

```
Offset  Size  Field              Type
------  ----  -----              ----
0       8     discriminator      [u8; 8]
8       32    config             Pubkey        StablecoinConfig PDA
40      32    authority          Pubkey        Copied from config at init
72      32    feed_account       Pubkey        Switchboard feed (or default for manual)
104     32    switchboard_program Pubkey       Switchboard program ID (cluster-specific)
136     12    pair               [u8; 12]      e.g. "EUR/USD", zero-padded
148     4     max_staleness      u32           Max staleness in slots
152     1     min_samples        u8            Minimum oracle samples required
153     8     max_confidence     u64           Max std dev (price units)
161     1     price_decimals     u8            Decimal places for cached price
162     1     enabled            bool          Whether feed is active
163     1     feed_type          u8            0 = Switchboard, 1 = Manual
164     8     last_cached_price  u64           Cached price (scaled by 10^price_decimals)
172     8     last_cached_slot   u64           Slot of last cache
180     8     last_cached_ts     i64           Timestamp of last cache
188     1     bump               u8            PDA bump
189     64    _reserved          [u8; 64]      Reserved for upgrades
------
Total: 253 bytes
```

---

## PDA Derivation Table

All PDAs are derived from the `sss_token` program unless noted.

| PDA | Seeds | Program | Purpose |
|-----|-------|---------|---------|
| StablecoinConfig | `["config", mint]` | sss_token | Central configuration for a stablecoin |
| MinterConfig | `["minter", config, minter_address]` | sss_token | Per-minter quota tracking |
| RoleAssignment | `["role", config, role_type_u8, address]` | sss_token | RBAC role assignment record |
| BlacklistEntry | `["blacklist", config, address]` | sss_token | Per-address blacklist entry |
| ExtraAccountMetaList | `["extra-account-metas", mint]` | transfer_hook | Transfer hook extra accounts |
| OracleFeedConfig | `["oracle-feed", config, pair_bytes]` | sss_oracle | Per-pair price feed config |

### TypeScript PDA Helpers

```typescript
import {
  getConfigPda,
  getMinterPda,
  getRolePda,
  getBlacklistPda,
  getExtraAccountMetasPda,
  getOracleFeedPda,
  encodePair,
} from "@stbr/sss-token";

const [configPda] = getConfigPda(mintPubkey);
const [minterPda] = getMinterPda(configPda, minterPubkey);
const [rolePda] = getRolePda(configPda, RoleType.Pauser, pauserPubkey);
const [blacklistPda] = getBlacklistPda(configPda, addressPubkey);
const [extraMetasPda] = getExtraAccountMetasPda(mintPubkey);
const [oracleFeedPda] = getOracleFeedPda(configPda, encodePair("EUR/USD"));
```

---

## Data Flows

### Initialize Flow (SSS-2)

```
Authority
    │
    v
sss_token::initialize(params)
    │
    ├── 1. Create mint account (system_program::create_account)
    ├── 2. Initialize PermanentDelegate extension (config PDA as delegate)
    ├── 3. Initialize TransferHook extension (hook program ID)
    ├── 4. Initialize DefaultAccountState extension (if frozen)
    ├── 5. Initialize MetadataPointer (points to mint itself)
    ├── 6. Initialize Mint (config PDA as mint_authority + freeze_authority)
    ├── 7. Initialize TokenMetadata (name, symbol, uri)
    └── 8. Write StablecoinConfig PDA
    │
    v
transfer_hook::initialize_extra_account_meta_list
    │
    ├── Creates ExtraAccountMetaList PDA with:
    │     Index 5: sss-token program ID
    │     Index 6: StablecoinConfig PDA
    │     Index 7: Source blacklist entry (external PDA, derived from source owner)
    │     Index 8: Dest blacklist entry (external PDA)
    │
    v
Done — mint is live with all extensions
```

All extensions must be initialized before `InitializeMint2`. Metadata is added after. This follows the PYUSD pattern: pre-initialize everything at creation because extensions cannot be added later.

### Transfer with Hook (SSS-2)

```
User calls transfer_checked via Token-2022
    │
    v
Token-2022 program
    ├── Validates transfer (amount, decimals, account ownership)
    ├── Detects TransferHook extension on mint
    ├── Resolves ExtraAccountMetaList PDA
    └── Invokes transfer_hook::transfer_hook(amount)
    │
    v
transfer_hook::transfer_hook
    │
    ├── 1. Verify source token account `transferring` flag via
    │       TransferHookAccount TLV extension (rejects direct invocation)
    │
    ├── 2. Validate config account owner == sss_token program ID
    │
    ├── 3. Read StablecoinConfig data (account index 6)
    │       Parse paused flag at dynamic Borsh offset
    │       REJECT if paused == true
    │
    ├── 4. Read source BlacklistEntry (account index 7)
    │       Account derived from source token account owner
    │       If account exists and data parses correctly: REJECT if active
    │       If account is empty (PDA not initialized): pass (not blacklisted)
    │       If discriminator invalid: REJECT (fail-closed)
    │
    ├── 5. Read dest BlacklistEntry (account index 8)
    │       Same logic as source
    │
    └── 6. Return Ok(()) — transfer proceeds
    │
    v
Token-2022 completes transfer
```

The hook reads accounts from the sss-token program but cannot write to them. Blacklist entries that don't exist (PDA not initialized) are treated as "not blacklisted" — this is the normal case for most addresses. Invalid data triggers rejection (fail-closed), not a pass.

### Seize Flow (SSS-2)

Seizure moves tokens from a frozen account to the treasury. It bypasses the transfer hook by using burn + mint instead of transfer.

```
Seizer (must have Seizer role)
    │
    v
sss_token::seize(amount)
    │
    ├── 1. Verify source account is frozen (state byte == 2)
    │       REJECT if not frozen (freeze-before-seize invariant)
    │
    ├── 2. Thaw source account
    │       CPI: Token-2022::thaw_account (config PDA = freeze authority)
    │
    ├── 3. Burn tokens from source
    │       CPI: Token-2022::burn_checked (config PDA = permanent delegate)
    │       Does NOT trigger transfer hook
    │
    ├── 4. Mint equivalent tokens to treasury
    │       CPI: Token-2022::mint_to (config PDA = mint authority)
    │       Does NOT trigger transfer hook
    │
    ├── 5. Re-freeze source account
    │       CPI: Token-2022::freeze_account (config PDA = freeze authority)
    │
    └── 6. Emit SeizeEvent
    │
    v
Done — tokens moved to treasury, source remains frozen
```

The thaw-burn-mint-refreeze pattern is necessary because:
- `burn_checked` requires the account to be unfrozen
- Using burn+mint avoids triggering the transfer hook (which would check blacklist status)
- Re-freezing preserves the frozen state for the blacklisted account
- Seize has no pause check — intentional for GENIUS Act compliance (law enforcement access during emergencies)

### RBAC Verification Flow

```
Instruction arrives with signer
    │
    v
Anchor account validation
    ├── config PDA verified by seeds constraint
    ├── role_assignment PDA verified by seeds:
    │     ["role", config.key(), role_type_u8, signer.key()]
    ├── If PDA doesn't exist: AccountNotInitialized error
    └── If PDA exists but wrong config: constraint error
    │
    v
Handler executes with verified role
```

Role verification is embedded in Anchor's account validation via PDA seeds. No explicit role-checking logic is needed in handler code — if the PDA exists with the correct seeds, the signer has the role.

### Oracle Price Caching Flow (Switchboard)

```
Anyone (permissionless)
    │
    v
sss_oracle::cache_price()
    │
    ├── 1. Verify feed_account.key() == stored oracle_feed.feed_account
    ├── 2. Verify feed_account.owner == stored oracle_feed.switchboard_program
    ├── 3. Verify oracle_feed.enabled == true
    ├── 4. Verify oracle_feed.feed_type == 0 (Switchboard)
    │
    ├── 5. Parse PullFeedAccountData at offset 2256
    │       Read CurrentResult: value (i128), std_dev (i128), num_samples (u8), slot (u64)
    │       All values in 18-decimal fixed-point
    │
    ├── 6. Validate: current_slot - feed_slot <= max_staleness
    ├── 7. Validate: num_samples >= min_samples
    ├── 8. Validate: std_dev <= max_confidence (if max_confidence > 0)
    ├── 9. Validate: value > 0 (reject negative/zero)
    │
    ├── 10. Convert: cached_price = value / 10^(18 - price_decimals)
    │
    └── 11. Write last_cached_price, last_cached_slot, last_cached_ts
    │
    v
Emit PriceCachedEvent
```

The Switchboard program ID is stored per-feed at initialization (not hardcoded), allowing the same program binary to work on mainnet (`SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv`) and devnet (`Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2`).

---

## Off-Chain Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Clients                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ React        │  │ Terminal UI  │  │ Admin CLI    │               │
│  │ Dashboard    │  │ (ratatui)    │  │ (sss-token)  │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                 │                        │
│         └────────────┬────┴─────────────────┘                        │
│                      │ RPC / WebSocket                               │
├──────────────────────┼───────────────────────────────────────────────┤
│  Backend Services    │  (Docker Compose)                             │
│                      │                                               │
│  ┌───────────────────┼────────────────────────────────────────────┐  │
│  │                   v                                            │  │
│  │  ┌────────────────────┐    ┌────────────────────┐             │  │
│  │  │ Mint/Burn Service  │    │ Compliance Service │             │  │
│  │  │ (port 3002)        │    │ (port 3003)        │             │  │
│  │  │                    │    │                    │             │  │
│  │  │ request → verify   │    │ OFAC screening     │             │  │
│  │  │ → execute → log    │    │ (fail-closed)      │             │  │
│  │  │                    │    │ Audit trail logging │             │  │
│  │  └────────┬───────────┘    └────────────────────┘             │  │
│  │           │                                                    │  │
│  │  ┌────────v───────────┐    ┌────────────────────┐             │  │
│  │  │ Indexer Service    │───>│ Webhook Service    │             │  │
│  │  │ (port 3001)        │    │ (port 3004)        │             │  │
│  │  │                    │    │                    │             │  │
│  │  │ WebSocket listener │    │ Event subscriptions │             │  │
│  │  │ 14 event decoders  │    │ Retry backoff       │             │  │
│  │  │ Auto-reconnect     │    │ DNS rebind protect  │             │  │
│  │  └────────────────────┘    └────────────────────┘             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                      │                                               │
├──────────────────────┼───────────────────────────────────────────────┤
│  On-Chain            │                                               │
│                      v                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ sss_token    │  │ transfer_hook│  │ sss_oracle   │              │
│  │ (both        │  │ (blacklist + │  │ (Switchboard │              │
│  │  presets)    │  │  pause check)│  │  + manual)   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└──────────────────────────────────────────────────────────────────────┘
```

All backend services are Docker-containerized with:
- Health check endpoints (`/health`)
- Structured JSON logging (pino)
- Bearer token auth middleware (`crypto.timingSafeEqual`, skip if `API_SECRET` unset)
- Environment-based configuration (`.env`)

---

## Token-2022 Extensions Used

| Extension | Purpose | Initialized By |
|-----------|---------|----------------|
| MetadataPointer | Points to embedded metadata on the mint | Always |
| TokenMetadata | Name, symbol, URI stored on-chain | Always |
| PermanentDelegate | Config PDA can burn from any token account | SSS-2 only |
| TransferHook | Routes transfers through hook program | SSS-2 only |
| DefaultAccountState | All new token accounts start frozen | Optional |

Extensions are immutable after mint creation. The `enable_permanent_delegate` and `enable_transfer_hook` flags in StablecoinConfig record which extensions are active.

Account sizing uses `ExtensionType::try_calculate_account_len()` — never manual calculation.

---

## Event System

All state-changing instructions emit Anchor events for off-chain indexing.

### sss_token Events (14)

| Event | Emitted By | Key Fields |
|-------|-----------|------------|
| InitializeEvent | initialize | authority, mint, treasury, decimals, extension flags |
| MintEvent | mint | authority, minter, recipient, amount, remaining_quota |
| BurnEvent | burn | authority, burner, amount |
| FreezeEvent | freeze_account | authority, account |
| ThawEvent | thaw_account | authority, account |
| PauseEvent | pause | authority |
| UnpauseEvent | unpause | authority |
| MinterUpdatedEvent | update_minter | authority, minter, quota_total, quota_remaining, action |
| RoleUpdatedEvent | update_roles | authority, address, role, action |
| AuthorityProposedEvent | propose_authority | authority, proposed |
| AuthorityAcceptedEvent | accept_authority | old_authority, new_authority |
| BlacklistAddEvent | add_to_blacklist | authority, address, reason |
| BlacklistRemoveEvent | remove_from_blacklist | authority, address |
| SeizeEvent | seize | authority, source, treasury, amount |

### sss_oracle Events (5)

| Event | Emitted By | Key Fields |
|-------|-----------|------------|
| FeedInitializedEvent | initialize_feed | config, authority, feed_pda, pair, feed_type |
| FeedConfigUpdatedEvent | update_feed_config | feed_pda, authority, field_changed |
| PriceCachedEvent | cache_price | feed_pda, pair, price, slot |
| ManualPriceSetEvent | set_manual_price | feed_pda, authority, price |
| FeedClosedEvent | close_feed | feed_pda, authority, pair |

All events include a `timestamp` field (Unix timestamp from `Clock::get()`).

---

## Error Codes

### sss_token (6000-6023)

| Code | Name | Description |
|------|------|-------------|
| 6000 | Unauthorized | Caller does not have the required role |
| 6001 | Paused | System is paused |
| 6002 | NotPaused | System is not paused |
| 6003 | SenderBlacklisted | Sender is blacklisted |
| 6004 | RecipientBlacklisted | Recipient is blacklisted |
| 6005 | AccountNotFrozen | Freeze before seize |
| 6006 | InvalidTreasury | Invalid treasury address |
| 6007 | QuotaExceeded | Minter quota exceeded |
| 6008 | BlacklistReasonRequired | Blacklist reason is required |
| 6009 | ComplianceNotEnabled | Compliance features not enabled on this config |
| 6010 | AlreadyBlacklisted | Address is already blacklisted |
| 6011 | NotBlacklisted | Address is not blacklisted |
| 6012 | InvalidRole | Invalid role type |
| 6013 | AuthorityMismatch | Authority mismatch |
| 6014 | PendingAuthorityMismatch | Only proposed authority can accept |
| 6015 | NoPendingAuthority | No pending authority transfer |
| 6016 | MinterAlreadyConfigured | Minter already configured |
| 6017 | MinterNotFound | Minter not found |
| 6018 | InvalidAmount | Amount must be greater than zero |
| 6019 | InvalidStringLength | String length exceeds maximum |
| 6020 | Overflow | Arithmetic overflow |
| 6021 | InvalidMint | Mint does not match config |
| 6022 | BlacklistReasonTooLong | Blacklist reason exceeds maximum length |
| 6023 | RoleAlreadyAssigned | Role already assigned — revoke first |

### transfer_hook (6000-6006)

| Code | Name | Description |
|------|------|-------------|
| 6000 | SenderBlacklisted | Sender is blacklisted |
| 6001 | RecipientBlacklisted | Recipient is blacklisted |
| 6002 | Paused | System is paused |
| 6003 | IsNotCurrentlyTransferring | Direct hook invocation rejected |
| 6004 | InvalidExtraAccountMetas | Invalid extra account metas |
| 6005 | InvalidConfig | Invalid StablecoinConfig account |
| 6006 | InvalidBlacklist | Cannot verify blacklist status |

### sss_oracle (6000-6012)

| Code | Name | Description |
|------|------|-------------|
| 6000 | InvalidAuthority | Caller is not the stablecoin authority |
| 6001 | InvalidConfigAccount | Wrong owner or discriminator on config |
| 6002 | InvalidPair | Currency pair must not be empty |
| 6003 | InvalidFeedType | Feed type not 0 or 1 |
| 6004 | InvalidDecimals | Price decimals exceeds 18 |
| 6005 | FeedDisabled | Feed is not enabled |
| 6006 | FeedAccountMismatch | Feed account does not match stored feed_account |
| 6007 | InvalidFeedOwner | Feed account not owned by Switchboard program |
| 6008 | InvalidSwitchboardData | Feed data invalid or too short |
| 6009 | StalePrice | Exceeds max_staleness slots |
| 6010 | ExcessiveConfidence | Std dev exceeds max_confidence |
| 6011 | InvalidPrice | Price is zero or negative |
| 6012 | Overflow | Arithmetic overflow in conversion |

---

## Security Model

### Authority Hierarchy

```
Master Authority
    │
    ├── assigns/revokes all 5 role types
    ├── transfers authority (two-step: propose → accept)
    ├── manages minters and quotas
    └── manages oracle feeds
    │
    ├── Minter ──── mint (with per-minter quota enforcement)
    ├── Burner ──── burn
    ├── Pauser ──── pause / unpause
    ├── Blacklister ── add_to_blacklist / remove_from_blacklist  (SSS-2)
    └── Seizer ──── seize (frozen accounts only)                 (SSS-2)
```

Multiple addresses can hold the same role. Role changes require master authority signature. Two-step authority transfer prevents accidental lockout.

### On-Chain Invariants

- **Checked arithmetic:** All arithmetic uses `checked_add`/`checked_sub`/`checked_mul`. `overflow-checks = true` in release profile.
- **No unwrap():** Zero `unwrap()` calls in program code — all errors handled explicitly.
- **PDA bumps stored:** Canonical bumps stored in state, never recalculated (saves CU, prevents bump confusion).
- **Mint validation:** Mint address validated against config on every Token-2022 CPI (prevents account confusion / Cashio-style attack).
- **Transferring flag:** Transfer hook verifies `transferring` flag via `TransferHookAccount` TLV extension — direct invocation without Token-2022 is rejected.
- **Freeze-before-seize:** Seize requires the target account to be frozen. Prevents accidental seizure of active accounts.
- **Account sizing:** `ExtensionType::try_calculate_account_len()` — never manual calculation.
- **Soft-delete blacklist:** Blacklist entries use an `active` flag for audit trail preservation. Accounts are not closed on removal.
- **Data zeroing:** Full `data.fill(0)` on account closure (role revoke, minter remove, feed close) — not just discriminator.
- **Source owner derivation:** Transfer hook derives source blacklist PDA from the token account's `owner` field via `AccountData` seed (not signer/delegate) — prevents bypass via un-blacklisted delegate.

### Fail-Closed Patterns

The transfer hook and oracle program both use fail-closed validation:

- **Transfer hook blacklist check:** If the blacklist entry PDA exists but the data doesn't parse correctly (wrong discriminator, unexpected format), the transfer is **rejected**. Only empty accounts (PDA not initialized) are treated as "not blacklisted."
- **Transfer hook config check:** If the StablecoinConfig account has the wrong owner or invalid data, the transfer is **rejected** via `require!()`.
- **Oracle authority validation:** Raw byte parsing of StablecoinConfig validates discriminator and program owner. Any parse failure returns `InvalidConfigAccount` — not a silent pass.
- **OFAC screening:** When the API URL is configured, the compliance service throws on any API failure. Screening failures block operations rather than producing false "clean" results.

### Backend Security

- **Auth middleware:** Bearer token via `API_SECRET` env var, validated with `crypto.timingSafeEqual` (no timing side-channels). Skipped if unset (dev mode).
- **SSRF protection:** `dns.resolve4()` at webhook dispatch time + `isPrivateIp()` check prevents DNS rebinding attacks. Registration-time validation alone is insufficient.
- **Parallel webhook dispatch:** `Promise.allSettled` — one dead subscriber does not block others.
- **Executor reconciliation:** `reconcileStaleRequests()` marks requests stuck in `processing` for >10 minutes as stale, preventing duplicate mints after crashes.

### Compile-Time Safety

- `overflow-checks = true` in release profile
- `#[account]` constraints validated by Anchor before handler execution
- `security_txt!` macro embedded in all three programs (visible on Solana Explorer)
- Formal verification: 3 Certora CVLR specs (17 rules) covering supply invariant, access control, pause enforcement
