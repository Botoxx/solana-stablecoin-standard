# Architecture

## 3-Layer Model

```
+---------------------------------------------------------------------+
|  Layer 3: Presets                                                    |
|  +---------------------------+  +----------------------------------+ |
|  | SSS-1 (Minimal)           |  | SSS-2 (Compliant)                | |
|  | mint/burn/freeze/pause    |  | SSS-1 + blacklist + seizure      | |
|  | RBAC (3 roles)            |  | RBAC (5 roles) + transfer hook   | |
|  +---------------------------+  +----------------------------------+ |
+---------------------------------------------------------------------+
|  Layer 2: Modules                                                    |
|  +---------------------------+  +----------------------------------+ |
|  | Compliance                |  | Privacy (future: SSS-3)          | |
|  | - Transfer hooks          |  | - Confidential transfers         | |
|  | - Blacklists (PDA/addr)   |  | - Allowlists                     | |
|  | - Permanent delegate      |  |                                  | |
|  +---------------------------+  +----------------------------------+ |
+---------------------------------------------------------------------+
|  Layer 1: Base SDK                                                   |
|  +----------------------------------------------------------------+ |
|  | Token creation (Token-2022) | Mint/freeze authorities           | |
|  | MetadataPointer + embedded  | Role-based access control         | |
|  | TokenMetadata               | TypeScript SDK + Admin CLI        | |
|  +----------------------------------------------------------------+ |
+---------------------------------------------------------------------+
```

Layers compose upward. SSS-1 uses Layer 1 only. SSS-2 adds Layer 2 compliance modules. Each preset is a configuration of the same Anchor program -- no separate program per preset.

## Program Architecture

Two on-chain programs cooperate:

```
                       sss-token program
                  (Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1)
                            |
        +-------------------+-------------------+
        |                   |                   |
  Core Instructions    Compliance Instr.    Token-2022 CPI
  (initialize, mint,   (add_to_blacklist,   (mint_to, burn,
   burn, freeze, thaw,  remove_from_bl,      freeze_account,
   pause, update_*)     seize)               thaw_account)
                            |
                            | reads BlacklistEntry PDAs
                            |
                   transfer-hook program
              (7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj)
                            |
              Called by Token-2022 on every transfer
              Checks: paused flag, sender blacklist, recipient blacklist
```

The transfer hook program is registered at mint creation when `enable_transfer_hook = true`. Token-2022 invokes it automatically on every `transfer_checked` call. The hook reads `StablecoinConfig` (for the paused flag) and `BlacklistEntry` PDAs (for sender/recipient status) from the sss-token program -- it does not own those accounts.

## Account Layout

### StablecoinConfig (248 bytes)

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

The `_reserved` field (64 bytes) provides space for future upgrades without reallocation.

### MinterConfig (121 bytes)

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
89      32    _reserved       [u8; 32]
------
Total: 121 bytes
```

### RoleAssignment (146 bytes)

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
114     32    _reserved       [u8; 32]
------
Total: 146 bytes
```

### BlacklistEntry (278 bytes)

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
246     32      _reserved        [u8; 32]
------
Total: 278 bytes
```

## PDA Derivation Table

All PDAs are derived from the sss-token program (`Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1`) unless noted.

| PDA | Seeds | Program | Purpose |
|-----|-------|---------|---------|
| StablecoinConfig | `["config", mint]` | sss-token | Central configuration for a stablecoin |
| MinterConfig | `["minter", config, minter_address]` | sss-token | Per-minter quota tracking |
| RoleAssignment | `["role", config, role_type_u8, address]` | sss-token | RBAC role assignment record |
| BlacklistEntry | `["blacklist", config, address]` | sss-token | Per-address blacklist entry |
| ExtraAccountMetaList | `["extra-account-metas", mint]` | transfer-hook | Transfer hook extra accounts configuration |

### TypeScript PDA Helpers

```typescript
import {
  getConfigPda,
  getMinterPda,
  getRolePda,
  getBlacklistPda,
  getExtraAccountMetasPda,
} from "@stbr/sss-token";

const [configPda, configBump] = getConfigPda(mintPubkey);
const [minterPda, minterBump] = getMinterPda(configPda, minterPubkey);
const [rolePda, roleBump] = getRolePda(configPda, RoleType.Pauser, pauserPubkey);
const [blacklistPda, blBump] = getBlacklistPda(configPda, addressPubkey);
const [extraMetasPda, emBump] = getExtraAccountMetasPda(mintPubkey);
```

## Data Flows

### Initialize Flow (SSS-2)

```
Authority
    |
    v
sss-token::initialize(params)
    |
    |-- 1. Create mint account (system_program::create_account)
    |-- 2. Initialize PermanentDelegate extension (config PDA as delegate)
    |-- 3. Initialize TransferHook extension (hook program ID)
    |-- 4. Initialize DefaultAccountState extension (if frozen)
    |-- 5. Initialize MetadataPointer (points to mint itself)
    |-- 6. Initialize Mint (config PDA as mint_authority + freeze_authority)
    |-- 7. Initialize TokenMetadata (name, symbol, uri)
    |-- 8. Write StablecoinConfig PDA
    |
    v
transfer_hook::initialize_extra_account_meta_list
    |
    |-- Creates ExtraAccountMetaList PDA with:
    |     Index 5: sss-token program ID
    |     Index 6: StablecoinConfig PDA
    |     Index 7: Source blacklist entry (external PDA)
    |     Index 8: Dest blacklist entry (external PDA)
    |
    v
Done -- mint is live with all extensions
```

All extensions must be initialized before `InitializeMint2`. Metadata is added after. This follows the PYUSD pattern: pre-initialize everything at creation because extensions cannot be added later.

### Transfer with Hook (SSS-2)

```
User calls transfer_checked via Token-2022
    |
    v
Token-2022 program
    |-- Validates transfer (amount, decimals, account ownership)
    |-- Detects TransferHook extension on mint
    |-- Resolves ExtraAccountMetaList PDA
    |-- Invokes transfer_hook::transfer_hook(amount)
    |
    v
transfer_hook::transfer_hook
    |
    |-- 1. Verify source token account is owned by Token-2022
    |       (prevents direct invocation attacks)
    |
    |-- 2. Read StablecoinConfig data (account index 6)
    |       Parse paused flag at dynamic offset
    |       REJECT if paused == true
    |
    |-- 3. Read source BlacklistEntry (account index 7)
    |       If account exists and active == true: REJECT
    |
    |-- 4. Read dest BlacklistEntry (account index 8)
    |       If account exists and active == true: REJECT
    |
    |-- 5. Return Ok(()) -- transfer proceeds
    |
    v
Token-2022 completes transfer
```

The hook reads accounts from the sss-token program but cannot write to them. Blacklist entries that don't exist (PDA not initialized) are treated as "not blacklisted" -- this is the normal case for most addresses.

### Seize Flow (SSS-2)

Seizure moves tokens from a frozen account to the treasury. It bypasses the transfer hook by using burn + mint instead of transfer.

```
Seizer (must have Seizer role)
    |
    v
sss-token::seize(amount)
    |
    |-- 1. Verify source account is frozen (state byte == 2)
    |       REJECT if not frozen (freeze-before-seize invariant)
    |
    |-- 2. Thaw source account
    |       CPI: Token-2022::thaw_account (config PDA = freeze authority)
    |
    |-- 3. Burn tokens from source
    |       CPI: Token-2022::burn_checked (config PDA = permanent delegate)
    |       Does NOT trigger transfer hook
    |
    |-- 4. Mint equivalent tokens to treasury
    |       CPI: Token-2022::mint_to (config PDA = mint authority)
    |       Does NOT trigger transfer hook
    |
    |-- 5. Re-freeze source account
    |       CPI: Token-2022::freeze_account (config PDA = freeze authority)
    |
    |-- 6. Emit SeizeEvent
    |
    v
Done -- tokens moved to treasury, source remains frozen
```

The thaw-burn-mint-refreeze pattern is necessary because:
- `burn_checked` requires the account to be unfrozen
- Using burn+mint avoids triggering the transfer hook (which would check blacklist status)
- Re-freezing preserves the frozen state for the blacklisted account

### RBAC Verification Flow

```
Instruction arrives with signer
    |
    v
Anchor account validation
    |-- config PDA verified by seeds constraint
    |-- role_assignment PDA verified by seeds:
    |     ["role", config.key(), role_type_u8, signer.key()]
    |-- If PDA doesn't exist: AccountNotInitialized error
    |-- If PDA exists but wrong config: constraint error
    |
    v
Handler executes with verified role
```

Role verification is embedded in Anchor's account validation via PDA seeds. No explicit role-checking logic is needed in handler code -- if the PDA exists with the correct seeds, the signer has the role.

## Token-2022 Extensions Used

| Extension | Purpose | Initialized By |
|-----------|---------|----------------|
| MetadataPointer | Points to embedded metadata on the mint | Always |
| TokenMetadata | Name, symbol, URI stored on-chain | Always |
| PermanentDelegate | Config PDA can burn from any token account | SSS-2 only |
| TransferHook | Routes transfers through hook program | SSS-2 only |
| DefaultAccountState | All new token accounts start frozen | Optional |

Extensions are immutable after mint creation. The `enable_permanent_delegate` and `enable_transfer_hook` flags in StablecoinConfig record which extensions are active.

## Event System

All state-changing instructions emit Anchor events for off-chain indexing:

| Event | Emitted By | Key Fields |
|-------|-----------|------------|
| InitializeEvent | initialize | authority, mint, treasury, decimals, extension flags |
| MintEvent | mint | minter, recipient, amount, remaining_quota |
| BurnEvent | burn | burner, amount |
| FreezeEvent | freeze_account | authority, account |
| ThawEvent | thaw_account | authority, account |
| PauseEvent | pause | authority |
| UnpauseEvent | unpause | authority |
| MinterUpdatedEvent | update_minter | minter, quota_total, action |
| RoleUpdatedEvent | update_roles | address, role, action |
| AuthorityProposedEvent | propose_authority | authority, proposed |
| AuthorityAcceptedEvent | accept_authority | old_authority, new_authority |
| BlacklistAddEvent | add_to_blacklist | address, reason |
| BlacklistRemoveEvent | remove_from_blacklist | address |
| SeizeEvent | seize | source, treasury, amount |

All events include a `timestamp` field (Unix timestamp from `Clock::get()`).

## Security Model

**Authority hierarchy:**
- Master Authority: assigns/revokes all roles, transfers authority
- Roles: scoped to specific operations (mint, burn, pause, blacklist, seize)
- Two-step authority transfer prevents accidental lockout

**On-chain invariants:**
- All arithmetic uses `checked_add`/`checked_sub`/`checked_mul`
- No `unwrap()` in program code
- PDA bumps stored in state, never recalculated
- Mint address validated against config on every Token-2022 CPI
- Transfer hook verifies token account owner to prevent direct invocation
- Seize requires frozen state (freeze-before-seize)
- Account sizes use `ExtensionType::try_calculate_account_len()`, never manual math
- Blacklist entries use soft delete (active flag) for audit trail preservation

**Compile-time safety:**
- `overflow-checks = true` in release profile
- `#[account]` constraints validated by Anchor before handler execution
