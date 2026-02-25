# SSS-2: Compliant Preset

## Overview

SSS-2 is the regulatory-grade stablecoin preset. It includes everything in SSS-1 plus blacklist enforcement via a transfer hook, token seizure via permanent delegate, and role separation between blacklisting and seizure operations. SSS-2 maps directly to the requirements of the GENIUS Act and OFAC sanctions compliance.

This is the preset to use for any stablecoin that needs to comply with US regulatory frameworks, interact with regulated financial institutions, or operate in jurisdictions requiring sanctions screening.

## Feature Set

| Feature | Mechanism | Role Required |
|---------|-----------|---------------|
| Mint tokens | Token-2022 `mint_to` via config PDA | Minter (with quota) |
| Burn tokens | Token-2022 `burn` via burner's authority | Burner |
| Freeze account | Token-2022 `freeze_account` via config PDA | Master Authority |
| Thaw account | Token-2022 `thaw_account` via config PDA | Master Authority |
| Pause / Unpause | Config `paused` flag, enforced by hook | Pauser |
| Blacklist add | Create/reactivate BlacklistEntry PDA | Blacklister |
| Blacklist remove | Soft-delete BlacklistEntry (active=false) | Blacklister |
| Seize tokens | Burn from source + mint to treasury | Seizer |
| Transfer enforcement | Transfer hook checks pause + blacklist | Automatic |

## Token-2022 Extensions

SSS-2 initializes four extensions at mint creation:

| Extension | Purpose | Authority |
|-----------|---------|-----------|
| MetadataPointer | Points to embedded metadata on the mint | Config PDA |
| TokenMetadata | Name, symbol, URI on-chain | Config PDA (update authority) |
| PermanentDelegate | Config PDA can burn from any token account | Config PDA (irrevocable) |
| TransferHook | Routes all transfers through the hook program | Config PDA |

The permanent delegate cannot be revoked or reassigned by token account owners. It is a mint-wide authority. If the config PDA's authority key is compromised, the permanent delegate authority is compromised. This is why Squads multisig is recommended for production.

## RBAC Roles

SSS-2 uses all 5 roles:

| Role | ID | Capabilities | Separation Rationale |
|------|-----|-------------|---------------------|
| **Master Authority** | N/A | Full control, role management, freeze/thaw | Single point of control |
| **Minter** | 0 | Mint tokens (quota-limited) | Limits issuance authority |
| **Burner** | 1 | Burn from own account | Separate from mint authority |
| **Pauser** | 2 | Emergency pause/unpause | Independent of authority |
| **Blacklister** | 3 | Add/remove blacklist entries | Separate from seizure |
| **Seizer** | 4 | Seize tokens from frozen accounts | Separate from blacklist |

### Role Separation: Blacklister vs Seizer

The Blacklister and Seizer are deliberately separate roles:

- **Blacklister**: Manages the sanctions list. Can block/unblock addresses. Cannot seize tokens.
- **Seizer**: Executes asset confiscation. Can only act on already-frozen accounts. Cannot modify the blacklist.

This separation enforces dual-authorization for compliance actions: one party identifies the sanctioned entity (blacklister), another party (or the authority via freeze + seizer) executes the asset recovery. This mirrors real-world compliance workflows where screening and enforcement are handled by different teams.

## Compliance Flow

### Blacklist Enforcement via Transfer Hook

Every `transfer_checked` call on an SSS-2 token triggers the transfer hook program. The hook performs three checks in order:

```
1. VERIFY: Source token account `transferring` flag via
   TransferHookAccount TLV extension (rejects direct invocation)
   |
   v
2. VALIDATE: Config account owner matches sss-token program
   |
   v
3. CHECK: StablecoinConfig.paused == false
   Read paused flag from config PDA
   REJECT with "Paused" if true
   |
   v
4. CHECK: Source not blacklisted
   Read BlacklistEntry PDA for source owner
   REJECT with "SenderBlacklisted" if active == true
   PDA doesn't exist = not blacklisted (normal case)
   |
   v
5. CHECK: Destination not blacklisted
   Read BlacklistEntry PDA for destination owner
   REJECT with "RecipientBlacklisted" if active == true
   PDA doesn't exist = not blacklisted (normal case)
   |
   v
6. ALLOW transfer
```

The hook resolves extra accounts via the ExtraAccountMetaList PDA:

| Index | Account | Source |
|-------|---------|--------|
| 0-4 | Standard transfer accounts | Token-2022 |
| 5 | sss-token program ID | Literal pubkey |
| 6 | StablecoinConfig PDA | Literal pubkey |
| 7 | Source blacklist entry PDA | External PDA: `["blacklist", config, source_owner]` |
| 8 | Dest blacklist entry PDA | External PDA: `["blacklist", config, dest_owner]` |

The hook uses a fail-closed pattern for blacklist checks. If the PDA account has no data (`data_is_empty()`), the address is not blacklisted. If data exists but the account owner or discriminator is invalid, the transfer is rejected -- indeterminate state blocks rather than allows. This means the normal (non-blacklisted) case has no PDA creation cost.

### Blacklist Lifecycle

```
Address identified as sanctioned (OFAC, compliance screening)
    |
    v
Blacklister calls add_to_blacklist(address, reason)
    |
    |-- Creates/reactivates BlacklistEntry PDA
    |-- Sets active = true, records reason, operator, timestamp
    |-- Emits BlacklistAddEvent
    |
    v
Address is now blocked from all transfers
(transfer hook will reject any transfer involving this address)
    |
    v
[Later: sanctions removed or false positive resolved]
    |
    v
Blacklister calls remove_from_blacklist(address)
    |
    |-- Sets active = false (soft delete)
    |-- PDA preserved for audit trail
    |-- Emits BlacklistRemoveEvent
    |
    v
Address can transfer again
```

The soft-delete pattern preserves the audit trail. The BlacklistEntry PDA retains the original reason, operator, and timestamp even after deactivation.

## Seizure Flow

Token seizure is a 4-step atomic operation that moves tokens from a target account to the treasury without triggering the transfer hook.

### Prerequisites

1. Target account must be **frozen** (freeze-before-seize invariant)
2. Signer must have the **Seizer** role
3. Stablecoin must have `enable_permanent_delegate: true`

### Step-by-Step

```
Seizer calls seize(amount)
    |
    |-- 1. VERIFY: source account state == Frozen (byte offset 108)
    |       Rejects with AccountNotFrozen if not frozen
    |
    |-- 2. THAW source account
    |       CPI: Token-2022::thaw_account
    |       Signer: config PDA (freeze authority)
    |
    |-- 3. BURN tokens from source
    |       CPI: Token-2022::burn_checked(amount, decimals)
    |       Signer: config PDA (permanent delegate)
    |       NOTE: burn_checked does NOT trigger transfer hook
    |
    |-- 4. MINT equivalent tokens to treasury
    |       CPI: Token-2022::mint_to(amount)
    |       Signer: config PDA (mint authority)
    |       NOTE: mint_to does NOT trigger transfer hook
    |
    |-- 5. RE-FREEZE source account
    |       CPI: Token-2022::freeze_account
    |       Signer: config PDA (freeze authority)
    |
    |-- 6. EMIT SeizeEvent(source, treasury, amount, timestamp)
    |
    v
Done. Tokens in treasury. Source remains frozen.
```

### Why burn+mint Instead of Transfer?

A direct `transfer_checked` would trigger the transfer hook, which would check the blacklist and reject the transfer (the source is presumably blacklisted). The burn+mint pattern bypasses the hook entirely:

- `burn_checked` and `mint_to` are not transfer operations
- They don't invoke transfer hooks
- The permanent delegate authority allows burning from any token account

The net effect is the same: tokens move from source to treasury. The supply remains constant (burn then mint of equal amount).

### Permanent Delegate Implications

The permanent delegate is an irrevocable mint-wide authority. The config PDA holds this role, and the config PDA is controlled by the master authority. Key implications:

- **Cannot be revoked** by token account owners -- this is by design for compliance
- **Applies to all token accounts** for this mint
- **If the authority key is compromised**, an attacker could burn tokens from any account
- **Mitigation**: Use a Squads multisig as the master authority

## Configuration

SSS-2 preset values:

```typescript
{
  permanentDelegate: true,
  transferHook: true,
  defaultAccountFrozen: false,
}
```

The `defaultAccountFrozen` option can be enabled via override for a stricter model where all new token accounts start frozen and must be explicitly thawed (allowlist pattern):

```typescript
const stable = await SolanaStablecoin.create(connection, {
  preset: Presets.SSS_2,
  name: "StrictUSD",
  symbol: "SUSD",
  uri: "",
  authority: authorityKeypair,
  extensions: { defaultAccountFrozen: true },  // Allowlist model
});
```

## Initialization (Full SSS-2)

```
Authority calls SolanaStablecoin.create(connection, { preset: Presets.SSS_2, ... })
    |
    v
sss-token::initialize
    |-- Create mint account (Token-2022)
    |-- Initialize PermanentDelegate (config PDA as delegate)
    |-- Initialize TransferHook (hook program ID)
    |-- Initialize MetadataPointer
    |-- InitializeMint2 (config PDA = mint_authority + freeze_authority)
    |-- Initialize TokenMetadata
    |-- Write StablecoinConfig PDA
    |
    v
transfer_hook::initialize_extra_account_meta_list
    |-- Create ExtraAccountMetaList PDA
    |-- Register 4 extra accounts (sss-token program, config, source bl, dest bl)
    |
    v
Set up roles:
    authority -> addMinter(minterPubkey, quota)
    authority -> addRole(burnerPubkey, Burner)
    authority -> addRole(pauserPubkey, Pauser)
    authority -> addRole(blacklisterPubkey, Blacklister)
    authority -> addRole(seizerPubkey, Seizer)
    |
    v
Stablecoin is fully operational
```

## Usage Examples

### Full Compliance Workflow

```typescript
import { SolanaStablecoin, Presets, RoleType } from "@stbr/sss-token";
import { BN } from "@coral-xyz/anchor";

// 1. Create SSS-2 stablecoin
const stable = await SolanaStablecoin.create(connection, {
  preset: Presets.SSS_2,
  name: "RegulatedUSD",
  symbol: "RUSD",
  uri: "https://example.com/rusd.json",
  authority,
  treasury: treasuryPubkey,
});

// 2. Set up all roles
await stable.addMinter(minter.publicKey, new BN(10_000_000_000));
await stable.addRole(burner.publicKey, RoleType.Burner);
await stable.addRole(pauser.publicKey, RoleType.Pauser);
await stable.addRole(blacklister.publicKey, RoleType.Blacklister);
await stable.addRole(seizer.publicKey, RoleType.Seizer);

// 3. Normal operations
const userAta = await stable.createTokenAccount(authority, user.publicKey);
await stable.mint({ recipient: userAta, amount: new BN(1_000_000_000), minter });

// 4. Compliance incident: user identified on OFAC SDN list
await stable.compliance.blacklistAdd(
  user.publicKey,
  "OFAC SDN match - Entity XYZ",
  blacklister
);

// At this point:
// - User cannot send tokens (transfer hook rejects)
// - User cannot receive tokens (transfer hook rejects)
// - Existing balance is still in user's account

// 5. Freeze + seize
await stable.freezeAccount(userAta);
await stable.compliance.seize(userAta, treasuryAta, new BN(1_000_000_000), seizer);

// Done. Tokens in treasury. User's account is frozen and empty.
```

### CLI Compliance Workflow

```bash
# Blacklist a sanctioned address
sss-token blacklist add \
  --config <PDA> \
  --address <SANCTIONED_PUBKEY> \
  --reason "OFAC SDN match - Entity XYZ"

# Verify blacklist status
sss-token blacklist check --config <PDA> --address <SANCTIONED_PUBKEY>

# Freeze their token account
sss-token freeze --config <PDA> --account <TOKEN_ACCOUNT>

# Seize tokens to treasury
sss-token seize \
  --config <PDA> \
  --from <TOKEN_ACCOUNT> \
  --to <TREASURY_TOKEN_ACCOUNT> \
  --amount 1000

# Check system status
sss-token status --config <PDA>
```

## Error Handling

SSS-2 compliance instructions fail gracefully on SSS-1 configurations:

| Instruction | SSS-1 Behavior |
|-------------|----------------|
| `add_to_blacklist` | Fails with `ComplianceNotEnabled` (transfer hook not enabled) |
| `remove_from_blacklist` | Fails with `ComplianceNotEnabled` |
| `seize` | Fails with `ComplianceNotEnabled` (permanent delegate not enabled) |

This is by design -- compliance features cannot be accidentally invoked on tokens that were not initialized with them.

## Security Considerations

- **Permanent delegate is irrevocable**: Once enabled at mint creation, it cannot be disabled. The config PDA will always have burn authority over all token accounts. Use multisig for production.
- **Transfer hook adds latency**: Every transfer requires the hook program to execute. Extra account resolution adds ~2 accounts to each transfer instruction. This is ~5-10K additional CU per transfer.
- **Blacklist PDA cost**: Each blacklist entry costs ~0.003 SOL in rent. For large-scale sanctions screening, budget for PDA creation costs.
- **Freeze-before-seize**: The seize instruction enforces this check. An unfrozen account cannot be seized. This prevents accidental seizure of accounts that are still active.
- **Soft-delete audit trail**: Removing an address from the blacklist sets `active = false` but preserves the PDA. The original reason, operator, and timestamp remain queryable for audit purposes.
- **Re-blacklisting**: An address that was previously removed can be re-blacklisted. The existing PDA is reactivated with updated reason, operator, and timestamp.
