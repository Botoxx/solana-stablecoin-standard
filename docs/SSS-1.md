# SSS-1: Minimal Preset

## Overview

SSS-1 is the minimal stablecoin preset. It provides core token management -- mint, burn, freeze, thaw, pause -- with role-based access control. No compliance extensions (blacklists, transfer hooks, permanent delegate) are enabled.

SSS-1 is designed for internal tokens, DAO treasuries, synthetic assets, and any use case where regulatory-grade compliance enforcement is not required.

## Feature Set

### Included

| Feature | Description |
|---------|-------------|
| **Token creation** | Token-2022 mint with MetadataPointer + embedded TokenMetadata |
| **Mint** | Issue tokens to any recipient token account (Minter role + quota) |
| **Burn** | Destroy tokens from the burner's own token account (Burner role) |
| **Freeze** | Freeze individual token accounts (Master Authority) |
| **Thaw** | Unfreeze frozen token accounts (Master Authority) |
| **Pause / Unpause** | Global system pause that blocks minting and burning (Pauser role) |
| **RBAC** | Minter (with quotas), Burner, Pauser roles |
| **Minter quotas** | Per-minter issuance limits, configurable by authority |
| **Authority transfer** | Two-step propose-accept transfer of master authority |
| **On-chain metadata** | Name, symbol, URI stored via Token-2022 metadata extension |

### Not Included

| Feature | Why Excluded | Available In |
|---------|-------------|-------------|
| Blacklist | No regulatory requirement | SSS-2 |
| Transfer hook | No per-transfer enforcement needed | SSS-2 |
| Permanent delegate | No seizure capability needed | SSS-2 |
| Token seizure | No authority over others' token accounts | SSS-2 |
| Default frozen accounts | New accounts can transact immediately | SSS-2 (optional) |
| Confidential transfers | ZK ElGamal Proof Program disabled | SSS-3 (future) |

## Configuration

SSS-1 preset values:

```typescript
{
  permanentDelegate: false,
  transferHook: false,
  defaultAccountFrozen: false,
}
```

Token-2022 extensions initialized:
- MetadataPointer (points to mint itself)
- TokenMetadata (name, symbol, uri)

That's it. No PermanentDelegate, no TransferHook, no DefaultAccountState.

## RBAC Roles

SSS-1 uses 3 of the 5 available roles:

| Role | ID | Capabilities |
|------|-----|-------------|
| **Master Authority** | N/A (stored in config) | Assign/revoke all roles, manage minters, freeze/thaw accounts, transfer authority |
| **Minter** | 0 | Mint tokens up to allocated quota |
| **Burner** | 1 | Burn tokens from own account |
| **Pauser** | 2 | Pause and unpause the system |

The Blacklister (3) and Seizer (4) roles can technically be assigned on an SSS-1 config, but the compliance instructions (`add_to_blacklist`, `seize`) will fail with `ComplianceNotEnabled` because the config flags are false.

## Initialization Flow

```
Authority calls SolanaStablecoin.create(connection, {
  preset: Presets.SSS_1,
  name: "MyDAO Token",
  symbol: "DAO",
  uri: "https://example.com/metadata.json",
  authority: authorityKeypair,
})
    |
    v
sss-token::initialize
    |-- Create mint account (Token-2022)
    |-- Initialize MetadataPointer extension
    |-- InitializeMint2 (config PDA = mint_authority + freeze_authority)
    |-- Initialize TokenMetadata (name, symbol, uri)
    |-- Write StablecoinConfig PDA
    |
    v
Mint is live. No transfer hook program interaction.
```

No `transfer_hook::initialize_extra_account_meta_list` call is made for SSS-1.

## Usage Examples

### SDK

```typescript
import { SolanaStablecoin, Presets, RoleType } from "@stbr/sss-token";
import { BN } from "@coral-xyz/anchor";

// Create SSS-1 stablecoin
const stable = await SolanaStablecoin.create(connection, {
  preset: Presets.SSS_1,
  name: "DAO Governance Token",
  symbol: "DGOV",
  uri: "",
  authority: authorityKeypair,
});

// Set up roles
await stable.addMinter(minterKeypair.publicKey, new BN(1_000_000_000));
await stable.addRole(burnerKeypair.publicKey, RoleType.Burner);
await stable.addRole(pauserKeypair.publicKey, RoleType.Pauser);

// Create token account and mint
const userAta = await stable.createTokenAccount(authorityKeypair, userPubkey);
await stable.mint({ recipient: userAta, amount: new BN(100_000_000), minter: minterKeypair });

// Check supply
const supply = await stable.getTotalSupply();
console.log(`Total supply: ${supply.toString()}`);

// Freeze an account
await stable.freezeAccount(userAta);

// Pause everything
await stable.pause(pauserKeypair);
```

### CLI

```bash
# Initialize
sss-token init --name "DAO Token" --symbol "DAO" --preset sss-1

# Set up minter
sss-token minters add --config <PDA> --address <MINTER_PUBKEY> --quota 100000

# Assign pauser role
sss-token roles add --config <PDA> --address <PAUSER_PUBKEY> --role pauser

# Mint tokens
sss-token mint --config <PDA> --to <TOKEN_ACCOUNT> --amount 500

# View status
sss-token status --config <PDA>
```

## Use Cases

### DAO Treasury Token

A DAO issues a token representing shares or governance weight. The DAO multisig is the authority. Minters are treasury operators with quotas matching approved issuance. The pauser role provides an emergency brake.

### Internal Stablecoin

A company uses an internal token pegged to fiat for payroll or vendor payments. No regulatory hook needed because transfers stay within a known set of wallets. Freeze capability handles lost/compromised keys.

### Synthetic Asset

A DeFi protocol issues a synthetic asset backed by collateral. Minters are the protocol's vault contracts (via CPI or the mint-burn service). Quotas enforce supply caps. Burning happens during redemption.

## Upgrade Path to SSS-2

Token-2022 extensions cannot be added after mint creation. If you need compliance features later, you must:

1. Create a new SSS-2 stablecoin
2. Migrate holders from the SSS-1 mint to the SSS-2 mint
3. Coordinate the cutover with token holders

Plan for this at design time. If there is any possibility of future regulatory requirements, start with SSS-2 -- the compliance features are no-ops when not actively used, and the gas cost difference is negligible.

## Security Considerations

- **Freeze authority** is held by the config PDA, controlled by the master authority. If the authority key is lost, frozen accounts cannot be thawed. Use a multisig (Squads) for production deployments.
- **Minter quotas** are enforced on-chain. A compromised minter key can only mint up to its remaining quota.
- **Pause** blocks minting and burning but does not block transfers (no transfer hook). Holders can still move tokens between accounts. Use freeze for per-account enforcement.
- **No transfer restrictions** -- SSS-1 has no transfer hook. Anyone can transfer tokens freely once they hold them. This is by design for the minimal preset.
